package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import com.payload.parser.utils.CommonUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;

@Service
public class JsonToCsvParseServiceImpl implements ParserService {
    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Response parse(Request request) {
        try {
            String result = convertJsonToCsv(request.getData(), "");
            return new Response(true, "success", result, HttpStatus.OK.toString());
        } catch (Exception e) {
            throw new RuntimeException("Invalid JSON input");
        }
    }

    @Override
    public String getType() {
        return "JSON_TO_CSV";
    }

    public static String convertJsonToCsv(String jsonString, String delimiter) throws IOException {
        JsonNode root = mapper.readTree(jsonString);
        List<Map<String, Object>> rows = new ArrayList<>();

        // Handle array or single object
        if (root.isArray()) {
            for (JsonNode item : root) {
                rows.add(CommonUtils.flatten(item, ""));
            }
        } else {
            rows.add(CommonUtils.flatten(root, ""));
        }

        if (rows.isEmpty()) return "";

        return CommonUtils.buidCsv(rows, delimiter);
    }
}
