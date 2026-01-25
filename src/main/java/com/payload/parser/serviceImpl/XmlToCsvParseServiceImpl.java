package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import com.payload.parser.utils.CommonUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;

@Service
public class XmlToCsvParseServiceImpl implements ParserService {
    private static final XmlMapper xmlMapper = new XmlMapper();

    @Override
    public Response parse(Request request) {
        try {
            String result = convertXmlToCsv(request.getData(), "");
            return new Response(true, "success", result, HttpStatus.OK.toString());
        } catch (Exception e) {
            throw new RuntimeException("Invalid XML input");
        }
    }

    @Override
    public String getType() {
        return "XML_TO_CSV";
    }

    public static String convertXmlToCsv(String xmlString, String delimiter) throws IOException {
        JsonNode root = xmlMapper.readTree(xmlString);
        List<Map<String, Object>> rows = new ArrayList<>();

        // Records: root elements or array
        if (root.isArray()) {
            for (JsonNode item : root) {
                rows.add(CommonUtils.flatten(item, ""));
            }
        } else if (root.isObject()) {
            List<JsonNode> recordNodes = getRecordNodes(root);
            for (JsonNode rec : recordNodes) {
                rows.add(CommonUtils.flatten(rec, ""));
            }
        }

        return CommonUtils.buidCsv(rows, delimiter);
    }

    private static List<JsonNode> getRecordNodes(JsonNode root) {
        List<JsonNode> records = new ArrayList<>();
        root.fieldNames().forEachRemaining(field -> {
            JsonNode node = root.get(field);
            if (node.isObject() || node.isArray()) {
                records.add(node);
            }
        });
        return records.isEmpty() ? List.of(root) : records;
    }
}
