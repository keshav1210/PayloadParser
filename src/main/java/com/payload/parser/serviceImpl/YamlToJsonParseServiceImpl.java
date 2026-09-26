package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * YAML → JSON. A file with several "---" documents becomes a JSON array.
 */
@Service
public class YamlToJsonParseServiceImpl implements ParserService {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Override
    public Response parse(Request request) {
        List<JsonNode> docs;
        try {
            docs = YamlSupport.readDocuments(request.getData());
        } catch (IllegalArgumentException e) {
            return new Response(false, e.getMessage(), null, HttpStatus.BAD_REQUEST.toString());
        }
        try {
            JsonNode result;
            if (docs.size() == 1) {
                result = docs.get(0);
            } else {
                ArrayNode all = JSON.createArrayNode();
                docs.forEach(all::add);
                result = all;
            }
            return new Response(true, "success",
                    JSON.writerWithDefaultPrettyPrinter().writeValueAsString(result), HttpStatus.OK.toString());
        } catch (JsonProcessingException e) {
            return new Response(false, "line 1, column 1: " + e.getOriginalMessage(), null, HttpStatus.BAD_REQUEST.toString());
        }
    }

    @Override
    public String getType() {
        return "YAML_TO_JSON";
    }
}
