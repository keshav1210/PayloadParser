package com.payload.parser.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.regex.Pattern;

/**
 * Lets browsers and Cloudflare cache static files. Files requested with a version query (?v=…) change URL
 * whenever they change, so they can be cached for a year; other static files are cached for an hour.
 * HTML pages are left alone so new content shows up straight away.
 */
@Component
public class StaticCacheFilter extends OncePerRequestFilter {

    static final String VERSIONED = "public, max-age=31536000, immutable";
    static final String UNVERSIONED = "public, max-age=3600";
    private static final Pattern VERSION = Pattern.compile("(^|&)v=[^&]+");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if ("GET".equals(request.getMethod()) && isStaticAsset(request.getRequestURI())) {
            String query = request.getQueryString();
            response.setHeader("Cache-Control", query != null && VERSION.matcher(query).find() ? VERSIONED : UNVERSIONED);
            // Spring's resource handler may set its own Cache-Control later (DevTools sets no-store); keep ours
            response = new HttpServletResponseWrapper(response) {
                @Override
                public void setHeader(String name, String value) {
                    if (!isCacheHeader(name)) super.setHeader(name, value);
                }

                @Override
                public void addHeader(String name, String value) {
                    if (!isCacheHeader(name)) super.addHeader(name, value);
                }

                @Override
                public void setDateHeader(String name, long date) {
                    if (!isCacheHeader(name)) super.setDateHeader(name, date);
                }
            };
        }
        chain.doFilter(request, response);
    }

    private static boolean isCacheHeader(String name) {
        return "Cache-Control".equalsIgnoreCase(name) || "Pragma".equalsIgnoreCase(name) || "Expires".equalsIgnoreCase(name);
    }

    /** CSS, scripts, images and fonts: never personal, never HTML pages. */
    static boolean isStaticAsset(String path) {
        return path.startsWith("/css/") || path.startsWith("/js/") || path.startsWith("/og/")
                || path.matches("^/[^?]*\\.(png|svg|ico|jpg|jpeg|webp|gif|woff2?|ttf)$");
    }
}
