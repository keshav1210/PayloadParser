package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class JsonFormatServiceImpl implements ParserService {
    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Response parse(Request request) {
        try {
            Object jsonObject = mapper.readValue(request.getData(), Object.class);
            ObjectWriter writer = mapper.writerWithDefaultPrettyPrinter();
            return new Response(true, "success", writer.writeValueAsString(jsonObject).replace("\r\n", "\n"), HttpStatus.OK.toString());
        } catch (Exception e) {
            throw new RuntimeException("Invalid JSON input");
        }
    }

    @Override
    public String getType() {
        return "JSON_FORMAT";
    }
}
