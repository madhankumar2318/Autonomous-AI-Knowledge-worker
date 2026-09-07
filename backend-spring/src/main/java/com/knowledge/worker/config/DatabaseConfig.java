package com.knowledge.worker.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
@Slf4j
public class DatabaseConfig {

    @Value("${SPRING_DATASOURCE_URL:${DATABASE_URL:}}")
    private String databaseUrl;

    @Value("${SPRING_DATASOURCE_USERNAME:${DATABASE_USER:}}")
    private String dbUser;

    @Value("${SPRING_DATASOURCE_PASSWORD:${DATABASE_PASSWORD:}}")
    private String dbPassword;

    @Bean
    @Primary
    public DataSource dataSource() {
        if (databaseUrl != null && !databaseUrl.isBlank() && 
            (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) && 
            !databaseUrl.startsWith("jdbc:")) {
            try {
                log.info("Configuring PostgreSQL datasource from standard cloud URL...");
                URI dbUri = new URI(databaseUrl);
                String userInfo = dbUri.getUserInfo();
                String user = dbUser;
                String pass = dbPassword;
                if (userInfo != null && userInfo.contains(":")) {
                    String[] parts = userInfo.split(":", 2);
                    user = parts[0];
                    pass = parts[1];
                }

                int port = dbUri.getPort() > 0 ? dbUri.getPort() : 5432;
                String dbPath = dbUri.getPath();
                String jdbcUrl = "jdbc:postgresql://" + dbUri.getHost() + ":" + port + dbPath;
                if (dbUri.getQuery() != null) {
                    jdbcUrl += "?" + dbUri.getQuery();
                }

                HikariConfig config = new HikariConfig();
                config.setJdbcUrl(jdbcUrl);
                config.setUsername(user);
                config.setPassword(pass);
                config.setDriverClassName("org.postgresql.Driver");
                config.setMaximumPoolSize(10);
                config.setMinimumIdle(2);
                config.setConnectionTimeout(30000);
                config.setIdleTimeout(600000);
                config.setMaxLifetime(1800000);
                return new HikariDataSource(config);
            } catch (Exception e) {
                log.error("Failed to parse PostgreSQL DATABASE_URL, falling back: {}", e.getMessage());
            }
        }

        HikariConfig config = new HikariConfig();
        String url = (databaseUrl != null && !databaseUrl.isBlank()) ? databaseUrl : "jdbc:h2:file:./data/workerdb;DB_CLOSE_ON_EXIT=FALSE;AUTO_RECONNECT=TRUE";
        config.setJdbcUrl(url);
        config.setUsername(dbUser != null && !dbUser.isBlank() ? dbUser : "sa");
        config.setPassword(dbPassword != null ? dbPassword : "");
        config.setDriverClassName(url.contains("postgresql") ? "org.postgresql.Driver" : "org.h2.Driver");
        return new HikariDataSource(config);
    }
}
