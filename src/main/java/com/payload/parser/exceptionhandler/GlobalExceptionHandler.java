package com.payload.parser.exceptionhandler;

import com.payload.parser.model.Response;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.HttpServerErrorException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Response> exceptionHandler(Exception ex) {
        return ResponseEntity.ok(errorResponse(ex.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR));
    }

    public Response errorResponse(String ex, HttpStatus code) {
        Response response = new Response();
        response.setSuccess(false);
        response.setMessage("Failed to Parse " + ex);
        response.setCode(code.toString());
        return response;
    }
}
