package com.payload.parser.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Keeps the app awake on Render's free plan.
 * <p>
 * Render stops a free web service after 15 minutes without incoming requests. Every few
 * minutes this calls the app's own public URL. The request goes through Render's proxy, so
 * it counts as traffic and the idle timer is reset.
 * <p>
 * Render sets {@code RENDER_EXTERNAL_URL} automatically, so this runs on Render and does
 * nothing locally. Set {@code KEEP_ALIVE_URL} to use another address, or
 * {@code KEEP_ALIVE_ENABLED=false} to switch it off.
 */
@Slf4j
@Component
public class KeepAliveScheduler {

    private final String pingUrl;
    private final boolean enabled;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public KeepAliveScheduler(@Value("${keepalive.url:}") String baseUrl,
                              @Value("${keepalive.enabled:true}") boolean enabled) {
        String base = baseUrl == null ? "" : baseUrl.trim().replaceAll("/+$", "");
        this.pingUrl = base.isEmpty() ? null : base + "/ping";
        this.enabled = enabled && pingUrl != null;
        if (this.enabled) {
            log.info("Keep-alive enabled: pinging {}", pingUrl);
        }
    }

    @Scheduled(initialDelayString = "${keepalive.interval:PT15M}", fixedRateString = "${keepalive.interval:PT15M}")
    public void ping() {
        if (!enabled) {
            return;
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(pingUrl))
                .timeout(Duration.ofSeconds(30))
                .header("User-Agent", "keep-alive")
                .GET()
                .build();
        try {
            HttpResponse<Void> response = client.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() >= 400) {
                log.warn("Keep-alive ping returned HTTP {}", response.statusCode());
            } else {
                log.debug("Keep-alive ping OK");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Keep-alive ping failed: {}", e.toString());
        }
    }
}
