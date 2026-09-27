package com.payload.parser.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * Tiny endpoint for the keep-alive job and external uptime monitors.
 * It does no work, so pinging it often costs almost nothing.
 */
@RestController
public class PingController {

    @RequestMapping(value = "/ping", method = {RequestMethod.GET, RequestMethod.HEAD})
    public ResponseEntity<String> ping() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body("ok");
    }
}
