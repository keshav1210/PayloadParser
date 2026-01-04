package com.payload.parser.controller;

import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/data")
public class RequestHandler {

    @PostMapping("/parse")
    public ResponseEntity<Response> convert(@RequestBody Request request){
        return ResponseEntity.ok(null);
    }
}
