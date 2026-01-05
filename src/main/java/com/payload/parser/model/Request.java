package com.payload.parser.model;

import com.payload.parser.enumration.Type;
import lombok.Builder;
import lombok.Data;

@Builder
@Data
public class Request {
    private Type type;
    private String data;
}
