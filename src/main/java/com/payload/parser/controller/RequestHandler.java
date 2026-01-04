package com.payload.parser.controller;

import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping
public class RequestHandler {

    public ResponseEntity<Response> convert(Request request){
        return ResponseEntity.ok(null);
    }
}
