package com.payload.parser.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.payload.parser.facade.ParserFacade;
import com.payload.parser.model.ConvertRequest;
import com.payload.parser.model.ConvertResponse;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.serviceImpl.ObjectConverterServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/data")
@CrossOrigin("*")
public class RequestHandler {
    @Autowired
    private ParserFacade parserFacade;

    @PostMapping("/parse")
    public ResponseEntity<Response> convert(@RequestBody Request request) {
        Response response = parserFacade.parse(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/object-to-json")
    public ResponseEntity<ConvertResponse> objectToJSON(@RequestBody ConvertRequest request) throws JsonProcessingException {
        if (request.getInputCode() == null || request.getInputCode().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ConvertResponse(null, "Input code is required"));
        }

        // Call the conversion service
        String convertedCode = parserFacade.objectToJson(request);

        return ResponseEntity.ok(new ConvertResponse(convertedCode, null));
    }
}
