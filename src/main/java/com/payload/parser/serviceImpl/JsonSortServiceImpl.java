package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class JsonSortServiceImpl implements ParserService {

    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Response parse(Request request) {
        return sortJson(request.getData(), true, false, false);
    }

    @Override
    public String getType() {
        return "JSON_SORT";
    }

    public Response sortJson(String json, boolean sortNestedObjects, boolean sortArrays, boolean caseSensitive) {
        try {
            JsonNode rootNode = mapper.readTree(json);
            JsonNode sorted = sortNode(rootNode, sortNestedObjects, sortArrays, caseSensitive);
            return new Response(true, "success",
                    mapper.writerWithDefaultPrettyPrinter().writeValueAsString(sorted),
                    HttpStatus.OK.toString()
            );
        } catch (Exception e) {
            throw new RuntimeException("Invalid JSON input");
        }
    }

    private static JsonNode sortNode(JsonNode node, boolean sortNestedObjects, boolean sortArrays, boolean caseSensitive) {
        if (node.isObject()) {
            return sortObject((ObjectNode) node, sortNestedObjects, sortArrays, caseSensitive);
        }
        if (node.isArray()) {
            return sortArray((ArrayNode) node, sortNestedObjects, sortArrays, caseSensitive);
        }
        return node; // primitive value
    }

    private static ObjectNode sortObject(ObjectNode objectNode, boolean sortNestedObjects, boolean sortArrays ,boolean caseSensitive) {
        ObjectNode sortedObject = mapper.createObjectNode();

        List<String> keys = new ArrayList<>();
        objectNode.fieldNames().forEachRemaining(keys::add);

        keys.sort(caseSensitive ? Comparator.naturalOrder() : String.CASE_INSENSITIVE_ORDER);

        for (String key : keys) {
            JsonNode value = objectNode.get(key);

            if (sortNestedObjects || sortArrays) {
                value = sortNode(value, sortNestedObjects, sortArrays, caseSensitive);
            }

            sortedObject.set(key, value);
        }

        return sortedObject;
    }

    private static ArrayNode sortArray(ArrayNode arrayNode, boolean sortNestedObjects, boolean sortArrays, boolean caseSensitive) {
        List<JsonNode> elements = new ArrayList<>();
        arrayNode.forEach(elements::add);

        // Recursive sort inside array
        if (sortNestedObjects || sortArrays) {
            for (int i = 0; i < elements.size(); i++) {
                elements.set(i, sortNode(elements.get(i), sortNestedObjects, sortArrays, caseSensitive));
            }
        }

        // Sort array itself
        if (sortArrays) {
            elements.sort((a, b) -> compareJsonNodes(a, b, caseSensitive));
        }

        ArrayNode sortedArray = mapper.createArrayNode();
        elements.forEach(sortedArray::add);

        return sortedArray;
    }

    private static int compareJsonNodes(JsonNode a, JsonNode b, boolean caseSensitive) {
        if (a.getNodeType() == b.getNodeType()) {
            return switch (a.getNodeType()) {
                case NUMBER -> Double.compare(a.asDouble(), b.asDouble());
                case STRING -> caseSensitive
                        ? a.asText().compareTo(b.asText())
                        : a.asText().compareToIgnoreCase(b.asText());
                case BOOLEAN -> Boolean.compare(a.asBoolean(), b.asBoolean());
                case OBJECT, ARRAY -> a.toString().compareTo(b.toString());
                default -> 0;
            };
        }

        // Deterministic ordering for mixed types
        return a.getNodeType().ordinal() - b.getNodeType().ordinal();
    }
}

