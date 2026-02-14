package com.payload.parser.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.payload.parser.model.RateLimitInfo;
import jakarta.servlet.*;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class CaffeineRateLimiterFilter implements Filter {

    private static final int MAX_REQUESTS = 50;

    @Autowired
    private Cache<String, AtomicInteger> cache;

    @Override
    public void doFilter(ServletRequest request,
                         ServletResponse response,
                         FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        // USE COOKIE BASED CLIENT ID (Anonymous Unique User)
        String clientId = getClientId(req, res);

        String apiPath = req.getRequestURI();

        // Per Client + Per API
        String cacheKey = clientId + ":" + apiPath;

        AtomicInteger counter = cache.get(cacheKey, k -> new AtomicInteger(0));

        int currentCount = counter.incrementAndGet();
        if (apiPath.equals("/429")) {

            // Check if user is rate limited on ANY API
            boolean rateLimited = cache.asMap().entrySet().stream()
                    .anyMatch(entry ->
                            entry.getKey().startsWith(clientId + ":")
                                    && entry.getValue().get() > MAX_REQUESTS
                    );

            if (!rateLimited) {
                res.sendRedirect("/");
                return;
            }

            chain.doFilter(request, response);
            return;
        }

        if (currentCount > MAX_REQUESTS) {
            res.setHeader("Retry-After", "60");
            res.sendRedirect("/429");
            return;
        }

        chain.doFilter(request, response);
    }

    private String getUserId(HttpServletRequest request) {

        String userId = request.getHeader("X-USER-ID");
        if (userId == null || userId.isBlank()) {
            userId = request.getRemoteAddr();
        }
        return userId;
    }

    private String getClientId(HttpServletRequest request,
                               HttpServletResponse response) {

        // 1️⃣ Check cookie
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("CLIENT_ID".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }

        // 2️⃣ If not exist → create new
        String newClientId = UUID.randomUUID().toString();

        Cookie cookie = new Cookie("CLIENT_ID", newClientId);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(60 * 60 * 24 * 365); // 1 year

        response.addCookie(cookie);

        return newClientId;
    }

}

