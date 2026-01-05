package com.payload.parser.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Response {
    private boolean success;
    private String message;
    private String parsedData;
    private String code;
}
