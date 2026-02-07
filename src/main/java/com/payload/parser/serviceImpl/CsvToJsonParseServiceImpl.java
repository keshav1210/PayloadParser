package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.StringReader;
import java.util.*;

@Service
public class CsvToJsonParseServiceImpl implements ParserService {

    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Response parse(Request request) {
        String result = convertCsv(request.getData(), ',');
        return new Response(true, "success", result, HttpStatus.OK.toString());
    }

    @Override
    public String getType() {
        return "CSV_TO_JSON";
    }

    public String convertCsv(String csv, char delimiter) {
        try{
            CSVFormat format = CSVFormat.DEFAULT.builder()
                    .setDelimiter(delimiter)
                    .setHeader()
                    .setSkipHeaderRecord(true)
                    .setIgnoreSurroundingSpaces(true)
                    .get();

            List<Map<String, String>> rows = new ArrayList<>();

            try (CSVParser parser = CSVParser.parse(new StringReader(csv), format)) {
                for (CSVRecord record : parser) {
                    Map<String, String> row = new LinkedHashMap<>();
                    for (String header : parser.getHeaderNames()) {
                        row.put(header, record.get(header));
                    }
                    rows.add(row);
                }
            }

            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(rows);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
