package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.payload.parser.model.ConvertRequest;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ObjectConverter;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ObjectConverterServiceImpl implements ObjectConverter {
//    @Override
//    public Response converter(ConvertRequest request) throws JsonProcessingException {
//        Map<String, ClassInfo> classMap = parseJavaCode(request.getInputCode());
//
//        // Take first class as main DTO
//        String mainClass = classMap.keySet().iterator().next();
//
//        Map<String, Object> json = buildJson(mainClass, classMap);
//
//        ObjectMapper mapper = new ObjectMapper();
//
//        return new Response(true,"Sucess",mapper.writerWithDefaultPrettyPrinter().writeValueAsString(json),"200");
//    }
@Override
public String converter(ConvertRequest request) {

    Map<String, ClassInfo> classes = parseCode(request.getInputCode(), request.getInputLang());

    // Convert to output language
    return generateCode(classes, request.getOutputLang(), request.getOutputFormat());
}


    private Map<String, ClassInfo> parseCode(String code, String language) {
        switch (language.toLowerCase()) {
            case "java":
                return parseJavaCode(code);
            case "python":
                return parsePythonCode(code);
            case "javascript":
            case "typescript":
                return parseJavaScriptCode(code);
            default:
                throw new IllegalArgumentException("Unsupported input language: " + language);
        }
    }


 /*   public static Map<String, Map<String, String>> parseAllClasses(String text) {

        Map<String, Map<String, String>> classMap = new LinkedHashMap<>();

        Pattern classPattern = Pattern.compile(
                "class\\s+(\\w+)\\s*\\{([\\s\\S]*?)\\}"
        );

        Matcher classMatcher = classPattern.matcher(text);

        while (classMatcher.find()) {

            String className = classMatcher.group(1);
            String body = classMatcher.group(2);

            Map<String, String> fields = parseFields(body);

            classMap.put(className, fields);
        }

        return classMap;
    }

    private static Map<String, String> parseFields(String body) {

        Map<String, String> map = new LinkedHashMap<>();

        Pattern fieldPattern = Pattern.compile(
                "private\\s+([\\w<>]+)\\s+(\\w+)\\s*;"
        );

        Matcher fieldMatcher = fieldPattern.matcher(body);

        while (fieldMatcher.find()) {
            map.put(fieldMatcher.group(2), fieldMatcher.group(1));
        }

        return map;
    }

    public static Map<String, Object> buildJson(
            String className,
            Map<String, Map<String, String>> classMap) {

        Map<String, Object> result = new LinkedHashMap<>();

        Map<String, String> fields = classMap.get(className);

        for (Map.Entry<String, String> entry : fields.entrySet()) {

            String fieldName = entry.getKey();
            String type = entry.getValue();

            result.put(fieldName, getValue(type, classMap));
        }

        return result;
    }

    private static Object getValue(String type,
                                   Map<String, Map<String, String>> classMap) {

        type = type.replace("java.lang.", "");

        // List Support
        if (type.startsWith("List<")) {

            String inner = type.substring(5, type.length() - 1);

            List<Object> list = new ArrayList<>();

            list.add(getValue(inner, classMap));

            return list;
        }

        // Primitive Types
        switch (type.toLowerCase()) {

            case "int":
            case "integer":
                return 123;

            case "long":
                return 123456L;

            case "double":
                return 12.34;

            case "float":
                return 1.2f;

            case "boolean":
                return true;

            case "string":
                return "dummy_text";

            case "bigdecimal":
                return 100.50;

            case "localdate":
                return "2026-01-01";

            case "localdatetime":
                return "2026-01-01T10:00:00";
        }

        // Nested DTO
        if (classMap.containsKey(type)) {
            return buildJson(type, classMap);
        }

        return null;
    }*/

 /*   private Map<String, ClassInfo> parseJavaCode(String code) {
        Map<String, ClassInfo> classes = new LinkedHashMap<>();

        // Pattern to match Java classes
        Pattern classPattern = Pattern.compile(
                "public\\s+class\\s+(\\w+)\\s*\\{([\\s\\S]*?)\\n\\}"
        );

        Matcher classMatcher = classPattern.matcher(code);

        while (classMatcher.find()) {
            String className = classMatcher.group(1);
            String classBody = classMatcher.group(2);

            ClassInfo classInfo = new ClassInfo(className);

            // Parse fields
            Pattern fieldPattern = Pattern.compile(
                    "private\\s+([\\w<>]+)\\s+(\\w+)\\s*;"
            );

            Matcher fieldMatcher = fieldPattern.matcher(classBody);

            while (fieldMatcher.find()) {
                String type = fieldMatcher.group(1);
                String name = fieldMatcher.group(2);
                classInfo.addField(name, type);
            }

            classes.put(className, classInfo);
        }

        return classes;
    }

    private Map<String, ClassInfo> parsePythonCode(String code) {
        Map<String, ClassInfo> classes = new LinkedHashMap<>();

        // Pattern to match Python classes
        Pattern classPattern = Pattern.compile(
                "class\\s+(\\w+)\\s*:([\\s\\S]*?)(?=\\nclass|\\Z)"
        );

        Matcher classMatcher = classPattern.matcher(code);

        while (classMatcher.find()) {
            String className = classMatcher.group(1);
            String classBody = classMatcher.group(2);

            ClassInfo classInfo = new ClassInfo(className);

            // Parse __init__ method to find fields
            Pattern initPattern = Pattern.compile(
                    "__init__\\s*\\([^)]*\\)\\s*:([\\s\\S]*?)(?=\\n    def|\\Z)"
            );

            Matcher initMatcher = initPattern.matcher(classBody);

            if (initMatcher.find()) {
                String initBody = initMatcher.group(1);

                // Find self.field assignments
                Pattern fieldPattern = Pattern.compile(
                        "self\\.(\\w+)\\s*="
                );

                Matcher fieldMatcher = fieldPattern.matcher(initBody);

                while (fieldMatcher.find()) {
                    String fieldName = fieldMatcher.group(1);
                    classInfo.addField(fieldName, "object");  // Python is dynamically typed
                }
            }

            classes.put(className, classInfo);
        }

        return classes;
    }

    private Map<String, ClassInfo> parseJavaScriptCode(String code) {
        Map<String, ClassInfo> classes = new LinkedHashMap<>();

        // Pattern to match JavaScript/TypeScript classes
        Pattern classPattern = Pattern.compile(
                "class\\s+(\\w+)\\s*\\{([\\s\\S]*?)\\n\\}"
        );

        Matcher classMatcher = classPattern.matcher(code);

        while (classMatcher.find()) {
            String className = classMatcher.group(1);
            String classBody = classMatcher.group(2);

            ClassInfo classInfo = new ClassInfo(className);

            // Find constructor and this.field assignments
            Pattern fieldPattern = Pattern.compile(
                    "this\\.(\\w+)\\s*="
            );

            Matcher fieldMatcher = fieldPattern.matcher(classBody);

            while (fieldMatcher.find()) {
                String fieldName = fieldMatcher.group(1);
                classInfo.addField(fieldName, "any");
            }

            classes.put(className, classInfo);
        }

        return classes;
    }

    private String generateCode(Map<String, ClassInfo> classes, String language, String format) {
        switch (language.toLowerCase()) {
            case "java":
                return generateJavaCode(classes);
            case "python":
                return generatePythonCode(classes);
            case "javascript":
                return generateJavaScriptCode(classes);
            case "typescript":
                return generateTypeScriptCode(classes);
            case "csharp":
                return generateCSharpCode(classes);
            case "json":
                return generateJSONSchema(classes);
            default:
                throw new IllegalArgumentException("Unsupported output language: " + language);
        }
    }

    private String generateJavaCode(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            sb.append("public class ").append(classInfo.getName()).append(" {\n");

            // Fields
            for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                String fieldName = field.getKey();
                String fieldType = field.getValue();

                // Convert basic types
                String javaType = convertToJavaType(fieldType, classes);

                sb.append("    private ").append(javaType).append(" ").append(fieldName).append(";\n");
            }

            sb.append("\n");

            // Getters and Setters
            for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                String fieldName = field.getKey();
                String fieldType = field.getValue();
                String javaType = convertToJavaType(fieldType, classes);
                String capitalizedName = capitalize(fieldName);

                // Getter
                sb.append("    public ").append(javaType).append(" get").append(capitalizedName).append("() {\n");
                sb.append("        return ").append(fieldName).append(";\n");
                sb.append("    }\n\n");

                // Setter
                sb.append("    public void set").append(capitalizedName).append("(").append(javaType).append(" ").append(fieldName).append(") {\n");
                sb.append("        this.").append(fieldName).append(" = ").append(fieldName).append(";\n");
                sb.append("    }\n\n");
            }

            sb.append("}\n\n");
        }

        return sb.toString().trim();
    }

    private String generatePythonCode(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            sb.append("class ").append(classInfo.getName()).append(":\n");

            // __init__ method
            sb.append("    def __init__(self");

            for (String fieldName : classInfo.getFields().keySet()) {
                sb.append(", ").append(fieldName);
            }

            sb.append("):\n");

            for (String fieldName : classInfo.getFields().keySet()) {
                sb.append("        self.").append(fieldName).append(" = ").append(fieldName).append("\n");
            }

            sb.append("\n\n");
        }

        return sb.toString().trim();
    }

    private String generateJavaScriptCode(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            sb.append("class ").append(classInfo.getName()).append(" {\n");

            // Constructor
            sb.append("    constructor(");

            List<String> fieldNames = new ArrayList<>(classInfo.getFields().keySet());
            for (int i = 0; i < fieldNames.size(); i++) {
                sb.append(fieldNames.get(i));
                if (i < fieldNames.size() - 1) {
                    sb.append(", ");
                }
            }

            sb.append(") {\n");

            for (String fieldName : fieldNames) {
                sb.append("        this.").append(fieldName).append(" = ").append(fieldName).append(";\n");
            }

            sb.append("    }\n");
            sb.append("}\n\n");
        }

        return sb.toString().trim();
    }

    private String generateTypeScriptCode(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            sb.append("interface ").append(classInfo.getName()).append(" {\n");

            for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                String fieldName = field.getKey();
                String fieldType = field.getValue();

                String tsType = convertToTypeScriptType(fieldType, classes);

                sb.append("    ").append(fieldName).append(": ").append(tsType).append(";\n");
            }

            sb.append("}\n\n");
        }

        return sb.toString().trim();
    }

    private String generateCSharpCode(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            sb.append("public class ").append(classInfo.getName()).append("\n{\n");

            for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                String fieldName = field.getKey();
                String fieldType = field.getValue();

                String csType = convertToCSharpType(fieldType, classes);
                String capitalizedName = capitalize(fieldName);

                sb.append("    public ").append(csType).append(" ").append(capitalizedName).append(" { get; set; }\n");
            }

            sb.append("}\n\n");
        }

        return sb.toString().trim();
    }

    private String generateJSONSchema(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");

        int classCount = 0;
        for (ClassInfo classInfo : classes.values()) {
            if (classCount > 0) sb.append(",\n");

            sb.append("  \"").append(classInfo.getName()).append("\": {\n");

            int fieldCount = 0;
            for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                if (fieldCount > 0) sb.append(",\n");

                String fieldName = field.getKey();
                String fieldType = field.getValue();

                String jsonType = convertToJSONType(fieldType, classes);

                sb.append("    \"").append(fieldName).append("\": ").append(jsonType);
                fieldCount++;
            }

            sb.append("\n  }");
            classCount++;
        }

        sb.append("\n}");

        return sb.toString();
    }

    // Type conversion helpers
    private String convertToJavaType(String type, Map<String, ClassInfo> classes) {
        if (classes.containsKey(type)) {
            return type;
        }

        switch (type.toLowerCase()) {
            case "int":
            case "integer":
                return "int";
            case "string":
            case "str":
                return "String";
            case "float":
            case "double":
                return "double";
            case "boolean":
            case "bool":
                return "boolean";
            case "list":
                return "List<Object>";
            default:
                return "Object";
        }
    }

    private String convertToTypeScriptType(String type, Map<String, ClassInfo> classes) {
        if (classes.containsKey(type)) {
            return type;
        }

        switch (type.toLowerCase()) {
            case "int":
            case "integer":
            case "float":
            case "double":
            case "long":
                return "number";
            case "string":
                return "string";
            case "boolean":
            case "bool":
                return "boolean";
            case "list":
                return "any[]";
            default:
                return "any";
        }
    }

    private String convertToCSharpType(String type, Map<String, ClassInfo> classes) {
        if (classes.containsKey(type)) {
            return type;
        }

        switch (type.toLowerCase()) {
            case "int":
            case "integer":
                return "int";
            case "string":
                return "string";
            case "float":
            case "double":
                return "double";
            case "boolean":
            case "bool":
                return "bool";
            case "list":
                return "List<object>";
            default:
                return "object";
        }
    }

    private String convertToJSONType(String type, Map<String, ClassInfo> classes) {
        if (classes.containsKey(type)) {
            return "{}";
        }

        switch (type.toLowerCase()) {
            case "int":
            case "integer":
            case "float":
            case "double":
            case "long":
                return "0";
            case "string":
                return "\"string\"";
            case "boolean":
            case "bool":
                return "true";
            case "list":
                return "[]";
            default:
                return "null";
        }
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) {
            return str;
        }
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }

    // Inner class to hold class information
    public static class ClassInfo {
        private String name;
        private Map<String, String> fields;

        public ClassInfo(String name) {
            this.name = name;
            this.fields = new LinkedHashMap<>();
        }

        public void addField(String name, String type) {
            fields.put(name, type);
        }

        public String getName() {
            return name;
        }

        public Map<String, String> getFields() {
            return fields;
        }
    }*/

    private Map<String, ClassInfo> parseJavaCode(String code) {
        Map<String, ClassInfo> classes = new LinkedHashMap<>();

        // Pattern to match Java classes
        Pattern classPattern = Pattern.compile(
                "public\\s+class\\s+(\\w+)\\s*\\{([\\s\\S]*?)\\n\\}"
        );

        Matcher classMatcher = classPattern.matcher(code);

        while (classMatcher.find()) {
            String className = classMatcher.group(1);
            String classBody = classMatcher.group(2);

            ClassInfo classInfo = new ClassInfo(className);

            // Parse fields
            Pattern fieldPattern = Pattern.compile(
                    "private\\s+([\\w<>]+)\\s+(\\w+)\\s*;"
            );

            Matcher fieldMatcher = fieldPattern.matcher(classBody);

            while (fieldMatcher.find()) {
                String type = fieldMatcher.group(1);
                String name = fieldMatcher.group(2);
                classInfo.addField(name, type);
            }

            classes.put(className, classInfo);
        }

        return classes;
    }

    private Map<String, ClassInfo> parsePythonCode(String code) {
        Map<String, ClassInfo> classes = new LinkedHashMap<>();

        // Pattern to match Python classes
        Pattern classPattern = Pattern.compile(
                "class\\s+(\\w+)\\s*:([\\s\\S]*?)(?=\\nclass|\\Z)"
        );

        Matcher classMatcher = classPattern.matcher(code);

        while (classMatcher.find()) {
            String className = classMatcher.group(1);
            String classBody = classMatcher.group(2);

            ClassInfo classInfo = new ClassInfo(className);

            // Parse __init__ method to find fields
            Pattern initPattern = Pattern.compile(
                    "__init__\\s*\\([^)]*\\)\\s*:([\\s\\S]*?)(?=\\n    def|\\Z)"
            );

            Matcher initMatcher = initPattern.matcher(classBody);

            if (initMatcher.find()) {
                String initBody = initMatcher.group(1);

                // Find self.field assignments
                Pattern fieldPattern = Pattern.compile(
                        "self\\.(\\w+)\\s*="
                );

                Matcher fieldMatcher = fieldPattern.matcher(initBody);

                while (fieldMatcher.find()) {
                    String fieldName = fieldMatcher.group(1);
                    classInfo.addField(fieldName, "object");  // Python is dynamically typed
                }
            }

            classes.put(className, classInfo);
        }

        return classes;
    }

    private Map<String, ClassInfo> parseJavaScriptCode(String code) {
        Map<String, ClassInfo> classes = new LinkedHashMap<>();

        // Pattern to match JavaScript/TypeScript classes
        Pattern classPattern = Pattern.compile(
                "class\\s+(\\w+)\\s*\\{([\\s\\S]*?)\\n\\}"
        );

        Matcher classMatcher = classPattern.matcher(code);

        while (classMatcher.find()) {
            String className = classMatcher.group(1);
            String classBody = classMatcher.group(2);

            ClassInfo classInfo = new ClassInfo(className);

            // Find constructor and this.field assignments
            Pattern fieldPattern = Pattern.compile(
                    "this\\.(\\w+)\\s*="
            );

            Matcher fieldMatcher = fieldPattern.matcher(classBody);

            while (fieldMatcher.find()) {
                String fieldName = fieldMatcher.group(1);
                classInfo.addField(fieldName, "any");
            }

            classes.put(className, classInfo);
        }

        return classes;
    }

    private String generateCode(Map<String, ClassInfo> classes, String language, String format) {
        switch (language.toLowerCase()) {
            case "java":
                return generateJavaCode(classes);
            case "python":
                return generatePythonCode(classes);
            case "javascript":
                return generateJavaScriptCode(classes);
            case "typescript":
                return generateTypeScriptCode(classes);
            case "csharp":
                return generateCSharpCode(classes);
            case "json":
                return generateJSONSchema(classes);
            default:
                throw new IllegalArgumentException("Unsupported output language: " + language);
        }
    }

    private String generateJavaCode(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            sb.append("public class ").append(classInfo.getName()).append(" {\n");

            // Fields
            for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                String fieldName = field.getKey();
                String fieldType = field.getValue();

                // Convert basic types
                String javaType = convertToJavaType(fieldType, classes);

                sb.append("    private ").append(javaType).append(" ").append(fieldName).append(";\n");
            }

            sb.append("\n");

            // Getters and Setters
            for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                String fieldName = field.getKey();
                String fieldType = field.getValue();
                String javaType = convertToJavaType(fieldType, classes);
                String capitalizedName = capitalize(fieldName);

                // Getter
                sb.append("    public ").append(javaType).append(" get").append(capitalizedName).append("() {\n");
                sb.append("        return ").append(fieldName).append(";\n");
                sb.append("    }\n\n");

                // Setter
                sb.append("    public void set").append(capitalizedName).append("(").append(javaType).append(" ").append(fieldName).append(") {\n");
                sb.append("        this.").append(fieldName).append(" = ").append(fieldName).append(";\n");
                sb.append("    }\n\n");
            }

            sb.append("}\n\n");
        }

        return sb.toString().trim();
    }

    private String generatePythonCode(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            sb.append("class ").append(classInfo.getName()).append(":\n");

            // __init__ method
            sb.append("    def __init__(self");

            for (String fieldName : classInfo.getFields().keySet()) {
                sb.append(", ").append(fieldName);
            }

            sb.append("):\n");

            for (String fieldName : classInfo.getFields().keySet()) {
                sb.append("        self.").append(fieldName).append(" = ").append(fieldName).append("\n");
            }

            sb.append("\n\n");
        }

        return sb.toString().trim();
    }

    private String generateJavaScriptCode(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            sb.append("class ").append(classInfo.getName()).append(" {\n");

            // Constructor
            sb.append("    constructor(");

            List<String> fieldNames = new ArrayList<>(classInfo.getFields().keySet());
            for (int i = 0; i < fieldNames.size(); i++) {
                sb.append(fieldNames.get(i));
                if (i < fieldNames.size() - 1) {
                    sb.append(", ");
                }
            }

            sb.append(") {\n");

            for (String fieldName : fieldNames) {
                sb.append("        this.").append(fieldName).append(" = ").append(fieldName).append(";\n");
            }

            sb.append("    }\n");
            sb.append("}\n\n");
        }

        return sb.toString().trim();
    }

    private String generateTypeScriptCode(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            sb.append("interface ").append(classInfo.getName()).append(" {\n");

            for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                String fieldName = field.getKey();
                String fieldType = field.getValue();

                String tsType = convertToTypeScriptType(fieldType, classes);

                sb.append("    ").append(fieldName).append(": ").append(tsType).append(";\n");
            }

            sb.append("}\n\n");
        }

        return sb.toString().trim();
    }

    private String generateCSharpCode(Map<String, ClassInfo> classes) {
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            sb.append("public class ").append(classInfo.getName()).append("\n{\n");

            for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                String fieldName = field.getKey();
                String fieldType = field.getValue();

                String csType = convertToCSharpType(fieldType, classes);
                String capitalizedName = capitalize(fieldName);

                sb.append("    public ").append(csType).append(" ").append(capitalizedName).append(" { get; set; }\n");
            }

            sb.append("}\n\n");
        }

        return sb.toString().trim();
    }

    private String generateJSONSchema(Map<String, ClassInfo> classes) {
        // Find the root class (the one that's not referenced as a field type in other classes)
        String rootClassName = findRootClass(classes);

        if (rootClassName == null && !classes.isEmpty()) {
            // If no clear root, use the first class
            rootClassName = classes.keySet().iterator().next();
        }

        if (rootClassName == null) {
            return "{}";
        }

        return generateJSONForClass(rootClassName, classes, 0);
    }

    private String findRootClass(Map<String, ClassInfo> classes) {
        Set<String> referencedClasses = new HashSet<>();

        // Collect all classes that are referenced as field types
        for (ClassInfo classInfo : classes.values()) {
            for (String fieldType : classInfo.getFields().values()) {
                if (classes.containsKey(fieldType)) {
                    referencedClasses.add(fieldType);
                }
            }
        }

        // Find a class that's not referenced (likely the root)
        for (String className : classes.keySet()) {
            if (!referencedClasses.contains(className)) {
                return className;
            }
        }

        return null;
    }

    private String generateJSONForClass(String className, Map<String, ClassInfo> classes, int indentLevel) {
        ClassInfo classInfo = classes.get(className);
        if (classInfo == null) {
            return "{}";
        }

        StringBuilder sb = new StringBuilder();
        String indent = "  ".repeat(indentLevel);
        String fieldIndent = "  ".repeat(indentLevel + 1);

        sb.append("{\n");

        int fieldCount = 0;
        for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
            if (fieldCount > 0) sb.append(",\n");

            String fieldName = field.getKey();
            String fieldType = field.getValue();

            sb.append(fieldIndent).append("\"").append(fieldName).append("\": ");

            // Check if this field type is a nested class
            if (classes.containsKey(fieldType)) {
                // Recursively generate JSON for nested class
                String nestedJson = generateJSONForClass(fieldType, classes, indentLevel + 1);
                sb.append(nestedJson);
            } else {
                // Use primitive type
                String jsonValue = convertToJSONType(fieldType, classes);
                sb.append(jsonValue);
            }

            fieldCount++;
        }

        sb.append("\n").append(indent).append("}");

        return sb.toString();
    }

    // Type conversion helpers
    private String convertToJavaType(String type, Map<String, ClassInfo> classes) {
        if (classes.containsKey(type)) {
            return type;
        }

        switch (type.toLowerCase()) {
            case "int":
            case "integer":
                return "int";
            case "string":
            case "str":
                return "String";
            case "float":
            case "double":
                return "double";
            case "boolean":
            case "bool":
                return "boolean";
            case "list":
                return "List<Object>";
            default:
                return "Object";
        }
    }

    private String convertToTypeScriptType(String type, Map<String, ClassInfo> classes) {
        if (classes.containsKey(type)) {
            return type;
        }

        switch (type.toLowerCase()) {
            case "int":
            case "integer":
            case "float":
            case "double":
            case "long":
                return "number";
            case "string":
                return "string";
            case "boolean":
            case "bool":
                return "boolean";
            case "list":
                return "any[]";
            default:
                return "any";
        }
    }

    private String convertToCSharpType(String type, Map<String, ClassInfo> classes) {
        if (classes.containsKey(type)) {
            return type;
        }

        switch (type.toLowerCase()) {
            case "int":
            case "integer":
                return "int";
            case "string":
                return "string";
            case "float":
            case "double":
                return "double";
            case "boolean":
            case "bool":
                return "bool";
            case "list":
                return "List<object>";
            default:
                return "object";
        }
    }

    private String convertToJSONType(String type, Map<String, ClassInfo> classes) {
        if (classes.containsKey(type)) {
            return "{}";
        }

        switch (type.toLowerCase()) {
            case "int":
            case "integer":
            case "float":
            case "double":
            case "long":
                return "0";
            case "string":
                return "\"string\"";
            case "boolean":
            case "bool":
                return "true";
            case "list":
                return "[]";
            default:
                return "null";
        }
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) {
            return str;
        }
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }

    // Inner class to hold class information
    private static class ClassInfo {
        private String name;
        private Map<String, String> fields;

        public ClassInfo(String name) {
            this.name = name;
            this.fields = new LinkedHashMap<>();
        }

        public void addField(String name, String type) {
            fields.put(name, type);
        }

        public String getName() {
            return name;
        }

        public Map<String, String> getFields() {
            return fields;
        }
    }
}
