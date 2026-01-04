package com.payload.parser.model;

import com.payload.parser.enumration.Type;

public class Request {
    private Type type;
    private String data;

    public Type getType() {
        return type;
    }

    public void setType(Type type) {
        this.type = type;
    }

    public String getData() {
        return data;
    }

    public void setData(String data) {
        this.data = data;
    }
}
