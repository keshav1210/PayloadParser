package com.payload.parser.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.payload.parser.model.ConvertRequest;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.serviceImpl.ObjectConverterServiceImpl;


import java.util.Map;

public interface ObjectConverter {
    public String converter(ConvertRequest request) throws JsonProcessingException;
}
