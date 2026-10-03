package com.knowledge.worker.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.util.Set;

/**
 * SSRF (Server-Side Request Forgery) defense.
 *
 * <p>Call {@link #validateUrl(String)} before making any outgoing HTTP request with a
 * user-supplied or externally-influenced URL. Throws {@link ResponseStatusException} with
 * HTTP 400 if the URL resolves to a restricted or internal address.
 *
 * <p>Blocked targets:
 * <ul>
 *   <li>Non-HTTP/HTTPS schemes (file://, ftp://, gopher://, jar://, etc.)</li>
 *   <li>Loopback: 127.0.0.0/8, ::1</li>
 *   <li>Link-local / cloud metadata: 169.254.0.0/16 (includes AWS 169.254.169.254, GCP metadata)</li>
 *   <li>Private RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16</li>
 *   <li>Broadcast / unspecified: 0.0.0.0, 255.255.255.255</li>
 *   <li>IPv6 private/link-local: fc00::/7 (unique local), fe80::/10 (link-local)</li>
 *   <li>Explicit hostname blocklist: localhost, metadata.google.internal, etc.</li>
 * </ul>
 */
@Component
@Slf4j
public class UrlSecurityValidator {

    private static final Set<String> BLOCKED_HOSTNAMES = Set.of(
            "localhost",
            "metadata.google.internal",   // GCP metadata server
            "metadata.goog",              // GCP metadata alternate
            "169.254.169.254",            // AWS/Azure/GCP instance metadata
            "100.100.100.200"             // Alibaba Cloud metadata
    );

    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

    /**
     * Validates that the given URL is safe to fetch externally.
     *
     * @param rawUrl the raw URL string to validate
     * @return a validated, parsed {@link URI}
     * @throws ResponseStatusException HTTP 400 if the URL is blocked or malformed
     */
    public URI validateUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "URL must not be empty.");
        }

        URI uri;
        try {
            uri = new URI(rawUrl.trim());
        } catch (URISyntaxException e) {
            log.warn("SSRF guard: malformed URL rejected: {}", rawUrl);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Malformed URL: " + rawUrl);
        }

        // 1. Scheme check — only http and https allowed
        String scheme = uri.getScheme();
        if (scheme == null || !ALLOWED_SCHEMES.contains(scheme.toLowerCase())) {
            log.warn("SSRF guard: blocked non-HTTP scheme '{}' in URL: {}", scheme, rawUrl);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "URL scheme '" + scheme + "' is not allowed. Only http and https are permitted.");
        }

        // 2. Host presence check
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            log.warn("SSRF guard: URL has no host: {}", rawUrl);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "URL must include a valid host.");
        }

        // 3. Blocked hostname check (exact match, case-insensitive)
        if (BLOCKED_HOSTNAMES.contains(host.toLowerCase())) {
            log.warn("SSRF guard: blocked hostname '{}' in URL: {}", host, rawUrl);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Access to the requested host is blocked for security reasons.");
        }

        // 4. DNS resolution + subnet check — guards against DNS rebinding and private IP access
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress addr : addresses) {
                checkAddress(addr, rawUrl);
            }
        } catch (UnknownHostException e) {
            log.warn("SSRF guard: could not resolve host '{}': {}", host, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unable to resolve the requested host: " + host);
        }

        log.debug("SSRF guard: URL passed validation: {}", rawUrl);
        return uri;
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    private void checkAddress(InetAddress addr, String rawUrl) {
        String ip = addr.getHostAddress();

        // Loopback: 127.0.0.0/8 or ::1
        if (addr.isLoopbackAddress()) {
            block(ip, "loopback", rawUrl);
        }

        // Link-local addresses
        if (addr.isLinkLocalAddress()) {
            block(ip, "link-local", rawUrl);
        }

        // Site-local / private addresses
        if (addr.isSiteLocalAddress()) {
            block(ip, "site-local private", rawUrl);
        }

        // Multicast
        if (addr.isMulticastAddress()) {
            block(ip, "multicast", rawUrl);
        }

        // IPv4-specific range checks
        if (addr instanceof Inet4Address) {
            checkIPv4(addr.getAddress(), ip, rawUrl);
        }

        // IPv6-specific range checks
        if (addr instanceof Inet6Address) {
            checkIPv6(addr.getAddress(), ip, rawUrl);
        }
    }

    /**
     * Explicit IPv4 subnet checks for ranges not covered by {@link InetAddress} convenience methods.
     */
    private void checkIPv4(byte[] octets, String ip, String rawUrl) {
        int b0 = Byte.toUnsignedInt(octets[0]);
        int b1 = Byte.toUnsignedInt(octets[1]);

        // 169.254.0.0/16 — link-local / cloud metadata (belt-and-suspenders, also caught by isLinkLocalAddress)
        if (b0 == 169 && b1 == 254) {
            block(ip, "link-local / cloud metadata (169.254.0.0/16)", rawUrl);
        }

        // 0.0.0.0/8 — unspecified
        if (b0 == 0) {
            block(ip, "unspecified address (0.0.0.0/8)", rawUrl);
        }

        // 255.x.x.x — broadcast
        if (b0 == 255) {
            block(ip, "broadcast address", rawUrl);
        }

        // 100.64.0.0/10 — CGNAT shared address space (used internally by some cloud providers)
        if (b0 == 100 && b1 >= 64 && b1 <= 127) {
            block(ip, "CGNAT shared address space (100.64.0.0/10)", rawUrl);
        }
    }

    /**
     * Explicit IPv6 subnet checks for unique local and link-local ranges.
     */
    private void checkIPv6(byte[] bytes, String ip, String rawUrl) {
        int b0 = Byte.toUnsignedInt(bytes[0]);

        // fc00::/7 — Unique Local (private IPv6, analogous to RFC 1918)
        if ((b0 & 0xFE) == 0xFC) {
            block(ip, "IPv6 unique local (fc00::/7)", rawUrl);
        }

        // fe80::/10 — Link-local (belt-and-suspenders alongside isLinkLocalAddress)
        if (b0 == 0xFE && (Byte.toUnsignedInt(bytes[1]) & 0xC0) == 0x80) {
            block(ip, "IPv6 link-local (fe80::/10)", rawUrl);
        }
    }

    private void block(String ip, String reason, String rawUrl) {
        log.warn("SSRF guard: blocked access to {} ({}) for URL: {}", ip, reason, rawUrl);
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Access to internal or restricted IP addresses is blocked for security reasons.");
    }
}
