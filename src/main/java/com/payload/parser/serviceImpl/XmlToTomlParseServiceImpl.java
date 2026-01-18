package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class XmlToTomlParseServiceImpl implements ParserService {
    private static final XmlMapper xmlMapper = new XmlMapper();

    @Override
    public Response parse(Request request) {
        try {
            JsonNode root = xmlMapper.readTree(request.getData().getBytes());
            StringBuilder toml = new StringBuilder();

            if (!root.isObject()) {
                throw new IllegalArgumentException("Invalid XML");
            }

            writeObject(toml, root, "");
            return new Response(true, "success", toml.toString().trim(), HttpStatus.OK.toString());
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    @Override
    public String getType() {
        return "XML_TO_TOML";
    }

    private static void writeObject(StringBuilder toml, JsonNode node, String path) {
        // 1. write primitives first
        node.fields().forEachRemaining(entry -> {
            JsonNode val = entry.getValue();
            if (val.isValueNode()) {
                writePrimitive(toml, path, entry.getKey(), val);
            }
        });

        // 2. write objects and arrays
        node.fields().forEachRemaining(entry -> {
            String key = entry.getKey();
            JsonNode val = entry.getValue();
            String newPath = path.isEmpty() ? key : path + "." + key;

            if (val.isObject()) {
                toml.append("\n[").append(newPath).append("]\n");
                writeObject(toml, val, newPath);
            }
            else if (val.isArray()) {
                writeArray(toml, val, newPath);
            }
        });
    }

    /* ===================== ARRAYS ===================== */

    private static void writeArray(StringBuilder toml, JsonNode array, String path) {
        if (array.isEmpty()) return;

        JsonNode first = array.get(0);

        // array of primitives
        if (first.isValueNode()) {
            toml.append(path)
                    .append(" = ")
                    .append(formatArray(array))
                    .append("\n");
            return;
        }

        // array of objects → [[table]]
        if (first.isObject()) {
            for (JsonNode item : array) {
                if (!item.isObject()) {
                    throw new IllegalArgumentException("Mixed arrays not allowed: " + path);
                }
                toml.append("\n[[")
                        .append(path)
                        .append("]]\n");
                writeObject(toml, item, path);
            }
            return;
        }

        throw new IllegalArgumentException("Unsupported array type: " + path);
    }

    /* ===================== PRIMITIVES ===================== */

    private static void writePrimitive(StringBuilder toml, String path, String key, JsonNode value) {
        if (value.isNull()) return;

        toml.append(path.isEmpty() ? key : path + "." + key)
                .append(" = ")
                .append(formatValue(value))
                .append("\n");
    }

    private static String formatValue(JsonNode value) {
        if (value.isTextual())
            return "\"" + escape(value.asText()) + "\"";
        if (value.isBoolean())
            return String.valueOf(value.asBoolean());
        if (value.isNumber())
            return value.numberValue().toString();

        throw new IllegalArgumentException("Unsupported primitive: " + value);
    }

    private static String formatArray(JsonNode array) {
        List<String> values = new ArrayList<>();
        for (JsonNode n : array) {
            if (!n.isValueNode()) {
                throw new IllegalArgumentException("Mixed arrays not allowed");
            }
            values.add(formatValue(n));
        }
        return "[" + String.join(", ", values) + "]";
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\t", "\\t");
    }
}
