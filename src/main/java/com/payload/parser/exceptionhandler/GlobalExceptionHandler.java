package com.payload.parser.exceptionhandler;

import com.payload.parser.model.Response;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.HttpServerErrorException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String NOT_FOUND_PAGE = """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <meta name="robots" content="noindex">
              <title>Page not found | JSON XML Editor</title>
              <style>
                body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
                       background: #111317; color: #d5d9e0; font-family: 'Segoe UI', Tahoma, sans-serif; text-align: center; padding: 16px; }
                h1 { color: #f2f4f8; font-size: 28px; margin: 0 0 8px; }
                a { color: #7fb0ff; margin: 0 8px; }
              </style>
            </head>
            <body>
              <main>
                <h1>Page not found</h1>
                <p>The page you are looking for doesn't exist or has moved.</p>
                <p><a href="/">Home</a><a href="/parser">JSON &amp; XML Formatter</a><a href="/json-parser">JSON Formatter</a></p>
              </main>
            </body>
            </html>
            """;

    // Unknown URLs must answer 404, not 200, or search engines index them as "soft 404" pages
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<String> notFound(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .contentType(MediaType.TEXT_HTML)
                .body(NOT_FOUND_PAGE);
    }

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
