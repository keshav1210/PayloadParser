package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class XmlToJsonParseServiceImpl implements ParserService {
    private static final ObjectMapper jsonMapper = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);
    private static final XmlMapper xmlMapper = new XmlMapper();

    @Override
    public Response parse(Request request) {
        try{
            JsonNode jsonNode = xmlMapper.readTree(request.getData().getBytes());
            return new Response(true, "success", jsonMapper.writeValueAsString(jsonNode), HttpStatus.OK.toString());
        } catch (Exception e) {
            throw new RuntimeException("Invalid XML input");
        }
    }

    @Override
    public String getType() {
        return "XML_TO_JSON";
    }
}
