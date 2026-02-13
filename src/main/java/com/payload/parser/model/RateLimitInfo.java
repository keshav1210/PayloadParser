package com.payload.parser.model;

public class RateLimitInfo {

    private int count;
    private long windowStart;

    public RateLimitInfo() {
        this.count = 0;
        this.windowStart = System.currentTimeMillis();
    }

    public int incrementAndGet() {
        return ++count;
    }

    public int getCount() {
        return count;
    }

    public long getWindowStart() {
        return windowStart;
    }

    public void reset() {
        this.count = 1;
        this.windowStart = System.currentTimeMillis();
    }
}
