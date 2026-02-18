package com.payload.parser.model;

import com.payload.parser.enumration.Type;
import lombok.Builder;
import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Builder
@Data
public class Request {
    private Type type;
    private String data;
    @Builder.Default
    private Map<String,Object> filters = new HashMap<>();
}
