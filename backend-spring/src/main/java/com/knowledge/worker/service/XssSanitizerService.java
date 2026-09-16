package com.knowledge.worker.service;

import org.springframework.stereotype.Service;

@Service
public class XssSanitizerService {

    public String sanitizePlainText(String input, int maxLength) {
        if (input == null) { return ""; }
        String result = input
                .replaceAll("<[^>]*>", "")
                .replaceAll("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]", "")
                .replaceAll("[\\u200B-\\u200D\\uFEFF]", "");
        if (result.length() > maxLength) { result = result.substring(0, maxLength); }
        return result;
    }

    public String sanitizeRichContent(String input, int maxLength) {
        if (input == null) { return ""; }
        String result = input
                .replaceAll("(?i)<\\s*/?(script|iframe|embed|object|svg|form|meta|link|base)[^>]*>", "")
                .replaceAll("(?i)\\bon\\w+\\s*=\\s*[\"'][^\"']*[\"']", "")
                .replaceAll("(?i)\\bon\\w+\\s*=[^\\s>]+", "")
                .replaceAll("(?i)javascript\\s*:", "javascript&#58;")
                .replaceAll("(?i)vbscript\\s*:", "vbscript&#58;")
                .replaceAll("(?i)data\\s*:\\s*text/html", "data:text&#47;html")
                .replaceAll("[\\u200B-\\u200D\\u202A-\\u202E\\uFEFF]", "");
        if (result.length() > maxLength) { result = result.substring(0, maxLength); }
        return result;
    }
}
