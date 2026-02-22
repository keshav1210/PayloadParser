package com.payload.parser.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.payload.parser.model.RateLimitInfo;
import com.payload.parser.model.ShareMeta;
import org.springframework.boot.autoconfigure.cache.CacheProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import com.github.benmanes.caffeine.cache.Cache;

@Configuration
public class CacheConfig {

    @Bean
    public Cache<String, AtomicInteger> rateLimitCache() {
        return Caffeine.newBuilder()
                .expireAfterWrite(1, TimeUnit.MINUTES)
                .maximumSize(10000)
                .build();
    }
    @Bean
    public Cache<String, ShareMeta> shareCache() {
        return Caffeine.newBuilder()
                .maximumWeight(100 * 1024 * 1024)
                .weigher((String k, ShareMeta v) -> (int) v.getSize())
                .expireAfterWrite(1, TimeUnit.MINUTES)
                .build();
    }
}
