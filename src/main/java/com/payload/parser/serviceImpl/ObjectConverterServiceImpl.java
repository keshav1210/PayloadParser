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
@Override
public String converter(ConvertRequest request) {

    Map<String, ClassInfo> classes = parseCode(request.getInputCode(), request.getInputLang(),request.getOutputFormat());

    // Convert to output language
    return generateCode(classes, request.getOutputLang(), request.getOutputFormat(),request.getJavaOptions(), request.getConstructorOptions());
}


    private Map<String, ClassInfo> parseCode(String code, String language,String format) {
        switch (language.toLowerCase()) {
            case "java":
                return parseJavaCode(code);
            case "python":
                return parsePythonCode(code);
            case "javascript":
            case "typescript":
                return parseJavaScriptCode(code);
            case "json":
                return parseJSONCode(code,format);
            default:
                throw new IllegalArgumentException("Unsupported input language: " + language);
        }
    }


    private Map<String, ClassInfo> parseJavaCode(String code) {
        Map<String, ClassInfo> classes = new LinkedHashMap<>();

        // Enhanced pattern to match Java classes with optional access modifiers and extends clause
        Pattern classPattern = Pattern.compile(
                "(?:public|protected|private)?\\s*class\\s+(\\w+)(?:\\s+extends\\s+(\\w+))?\\s*\\{([\\s\\S]*?)\\n\\}"
        );

        Matcher classMatcher = classPattern.matcher(code);

        while (classMatcher.find()) {
            String className = classMatcher.group(1);
            String parentClass = classMatcher.group(2); // Can be null if no extends
            String classBody = classMatcher.group(3);

            ClassInfo classInfo = new ClassInfo(className);
            if (parentClass != null) {
                classInfo.setParentClass(parentClass);
            }

            // Parse fields - need to distinguish from methods
            // Look for field declarations that end with semicolon, not methods with parentheses
            Pattern fieldPattern = Pattern.compile(
                    "^\\s*(?:public|protected|private)?\\s+(?:static\\s+)?(?:final\\s+)?([\\w<>,\\s\\[\\]]+)\\s+(\\w+)\\s*(?:=\\s*[^;]+)?\\s*;",
                    Pattern.MULTILINE
            );

            Matcher fieldMatcher = fieldPattern.matcher(classBody);

            while (fieldMatcher.find()) {
                String type = fieldMatcher.group(1).trim();
                String name = fieldMatcher.group(2);

                // Additional check: make sure the line doesn't contain method-like patterns
                String matchedLine = fieldMatcher.group(0);
                if (!matchedLine.contains("(") && !matchedLine.contains(")")) {
                    classInfo.addField(name, type);
                }
            }

            classes.put(className, classInfo);
        }

        // Handle inheritance - merge parent fields into child classes
        for (ClassInfo classInfo : classes.values()) {
            if (classInfo.getParentClass() != null) {
                ClassInfo parentInfo = classes.get(classInfo.getParentClass());
                if (parentInfo != null) {
                    // Add parent fields to child class
                    for (Map.Entry<String, String> parentField : parentInfo.getFields().entrySet()) {
                        // Only add if not already present (child can override)
                        if (!classInfo.getFields().containsKey(parentField.getKey())) {
                            classInfo.addField(parentField.getKey(), parentField.getValue());
                        }
                    }
                }
            }
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

    private String generateCode(Map<String, ClassInfo> classes, String language, String format, String javaOptions, String constructorOptions) {
        switch (language.toLowerCase()) {
            case "java":
                return generateJavaCode(classes, javaOptions, constructorOptions);
            case "python":
                return generatePythonCode(classes);
            case "javascript":
                return generateJavaScriptCode(classes);
            case "typescript":
                return generateTypeScriptCode(classes);
            case "csharp":
                return generateCSharpCode(classes);
            case "json":
                return generateJSONSchema(classes,format);
            default:
                throw new IllegalArgumentException("Unsupported output language: " + language);
        }
    }

    /*private String generateJavaCode(Map<String, ClassInfo> classes) {
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
    }*/

    private String generateJavaCode(Map<String, ClassInfo> classes, String javaOptions, String constructorOptions) {
        boolean useLombok = "lombok".equalsIgnoreCase(javaOptions);
        StringBuilder sb = new StringBuilder();

        for (ClassInfo classInfo : classes.values()) {
            // Add Lombok annotations if selected
            if (useLombok) {
                sb.append("import lombok.Data;\n");
                sb.append("import lombok.NoArgsConstructor;\n");
                sb.append("import lombok.AllArgsConstructor;\n\n");

                sb.append("@Data\n");
                sb.append("@NoArgsConstructor\n");
                sb.append("@AllArgsConstructor\n");
            }

            sb.append("public class ").append(classInfo.getName()).append(" {\n");

            // Fields
            for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                String fieldName = field.getKey();
                String fieldType = field.getValue();
                String javaType = convertToJavaType(fieldType, classes);
                sb.append("    private ").append(javaType).append(" ").append(fieldName).append(";\n");
            }

            sb.append("\n");

            // If NOT using Lombok, generate constructors and getters/setters
            if (!useLombok) {
                // Generate constructors based on selection
                if ("noargs".equalsIgnoreCase(constructorOptions) || "both".equalsIgnoreCase(constructorOptions)) {
                    // No-args constructor
                    sb.append("    public ").append(classInfo.getName()).append("() {\n");
                    sb.append("    }\n\n");
                }

                if ("allargs".equalsIgnoreCase(constructorOptions) || "both".equalsIgnoreCase(constructorOptions)) {
                    // All-args constructor
                    sb.append("    public ").append(classInfo.getName()).append("(");

                    List<Map.Entry<String, String>> fieldList = new ArrayList<>(classInfo.getFields().entrySet());
                    for (int i = 0; i < fieldList.size(); i++) {
                        Map.Entry<String, String> field = fieldList.get(i);
                        String fieldName = field.getKey();
                        String fieldType = field.getValue();
                        String javaType = convertToJavaType(fieldType, classes);

                        sb.append(javaType).append(" ").append(fieldName);
                        if (i < fieldList.size() - 1) {
                            sb.append(", ");
                        }
                    }

                    sb.append(") {\n");

                    for (Map.Entry<String, String> field : classInfo.getFields().entrySet()) {
                        String fieldName = field.getKey();
                        sb.append("        this.").append(fieldName).append(" = ").append(fieldName).append(";\n");
                    }

                    sb.append("    }\n\n");
                }

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

    private String generateJSONSchema(Map<String, ClassInfo> classes, String format) {
        // Find the root class (the one that's not referenced as a field type in other classes)
        String rootClassName = findRootClass(classes);

        if (rootClassName == null && !classes.isEmpty()) {
            // If no clear root, use the first class
            rootClassName = classes.keySet().iterator().next();
        }

        if (rootClassName == null) {
            return "{}";
        }

        return generateJSONForClass(rootClassName, classes, 0,format);
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

    private String generateJSONForClass(String className, Map<String, ClassInfo> classes, int indentLevel, String format) {
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
            String snakeCaseFieldName=fieldName;
            if(format.equalsIgnoreCase("SnakeCase")){
                snakeCaseFieldName = toSnakeCase(fieldName);
            }


            sb.append(fieldIndent).append("\"").append(snakeCaseFieldName).append("\": ");

            // Check if this field type is a nested class
            if (classes.containsKey(fieldType)) {
                // Recursively generate JSON for nested class
                String nestedJson = generateJSONForClass(fieldType, classes, indentLevel + 1,format);
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
//    private static class ClassInfo {
//        private String name;
//        private Map<String, String> fields;
//
//        public ClassInfo(String name) {
//            this.name = name;
//            this.fields = new LinkedHashMap<>();
//        }
//
//        public void addField(String name, String type) {
//            fields.put(name, type);
//        }
//
//        public String getName() {
//            return name;
//        }
//
//        public Map<String, String> getFields() {
//            return fields;
//        }
//    }

    private static class ClassInfo {
        private String name;
        private String parentClass;
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

        public String getParentClass() {
            return parentClass;
        }

        public void setParentClass(String parentClass) {
            this.parentClass = parentClass;
        }
    }
    private String toSnakeCase(String str) {
        if (str == null || str.isEmpty()) {
            return str;
        }

        // Handle acronyms and consecutive capital letters
        String result = str.replaceAll("([A-Z]+)([A-Z][a-z])", "$1_$2");

        // Handle normal camelCase
        result = result.replaceAll("([a-z\\d])([A-Z])", "$1_$2");

        // Convert to lowercase
        return result.toLowerCase();
    }


    /*private Map<String, ClassInfo> parseJSONCode(String code) {
        Map<String, ClassInfo> classes = new LinkedHashMap<>();

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            Map<String, Object> jsonMap = objectMapper.readValue(code, Map.class);

            // Generate a root class from the JSON
            ClassInfo rootClass = new ClassInfo("RootObject");
            analyzeJSONStructure(jsonMap, rootClass, classes, "RootObject");
            classes.put("RootObject", rootClass);

        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid JSON format: " + e.getMessage());
        }

        return classes;
    }*/

    private Map<String, ClassInfo> parseJSONCode(String code, String format) {
        Map<String, ClassInfo> classes = new LinkedHashMap<>();

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            Map<String, Object> jsonMap = objectMapper.readValue(code, Map.class);

            // Generate a root class from the JSON
            ClassInfo rootClass = new ClassInfo("RootObject");
            analyzeJSONStructure(jsonMap, rootClass, classes, "RootObject", format);
            classes.put("RootObject", rootClass);

        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid JSON format: " + e.getMessage());
        }

        return classes;
    }

    private void analyzeJSONStructure(Map<String, Object> jsonMap, ClassInfo currentClass,
                                      Map<String, ClassInfo> allClasses, String currentClassName, String format) {
        for (Map.Entry<String, Object> entry : jsonMap.entrySet()) {
            String fieldName = entry.getKey();
            Object value = entry.getValue();

            // Convert field name based on format
            String convertedFieldName = convertFieldNameByFormat(fieldName, format);

            String fieldType = inferTypeFromValue(value, fieldName, allClasses, format);
            currentClass.addField(convertedFieldName, fieldType);
        }
    }

    private String inferTypeFromValue(Object value, String fieldName, Map<String, ClassInfo> allClasses, String format) {
        if (value == null) {
            return "Object";
        } else if (value instanceof String) {
            return "String";
        } else if (value instanceof Integer) {
            return "int";
        } else if (value instanceof Long) {
            return "long";
        } else if (value instanceof Double || value instanceof Float) {
            return "double";
        } else if (value instanceof Boolean) {
            return "boolean";
        } else if (value instanceof List) {
            List<?> list = (List<?>) value;
            if (!list.isEmpty()) {
                Object firstElement = list.get(0);
                if (firstElement instanceof Map) {
                    // Nested object in array
                    String nestedClassName = capitalize(toCamelCase(fieldName)) + "Item";
                    ClassInfo nestedClass = new ClassInfo(nestedClassName);
                    analyzeJSONStructure((Map<String, Object>) firstElement, nestedClass, allClasses, nestedClassName, format);
                    allClasses.put(nestedClassName, nestedClass);
                    return "List<" + nestedClassName + ">";
                } else {
                    String elementType = inferTypeFromValue(firstElement, fieldName, allClasses, format);
                    return "List<" + elementType + ">";
                }
            }
            return "List<Object>";
        } else if (value instanceof Map) {
            // Nested object
            String nestedClassName = capitalize(toCamelCase(fieldName));
            ClassInfo nestedClass = new ClassInfo(nestedClassName);
            analyzeJSONStructure((Map<String, Object>) value, nestedClass, allClasses, nestedClassName, format);
            allClasses.put(nestedClassName, nestedClass);
            return nestedClassName;
        }

        return "Object";
    }

    private String convertFieldNameByFormat(String fieldName, String format) {
        if (format == null) {
            return fieldName;
        }

        if (format.equalsIgnoreCase("CamelCase")) {
            return toCamelCase(fieldName);
        } else if (format.equalsIgnoreCase("SnakeCase")) {
            return toSnakeCase(fieldName);
        }

        return fieldName;
    }

    private String toCamelCase(String str) {
        if (str == null || str.isEmpty()) {
            return str;
        }

        // If already in camelCase, return as is
        if (!str.contains("_") && !str.contains("-")) {
            return str;
        }

        // Convert snake_case or kebab-case to camelCase
        StringBuilder result = new StringBuilder();
        boolean capitalizeNext = false;

        for (int i = 0; i < str.length(); i++) {
            char ch = str.charAt(i);

            if (ch == '_' || ch == '-') {
                capitalizeNext = true;
            } else {
                if (capitalizeNext) {
                    result.append(Character.toUpperCase(ch));
                    capitalizeNext = false;
                } else {
                    result.append(Character.toLowerCase(ch));
                }
            }
        }

        return result.toString();
    }
}
