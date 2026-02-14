package com.payload.parser.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping
public class ViewHandler {

    @GetMapping("/")
    public String  viewHomePage(){
        return "home.html";
    }

    @GetMapping("/parser")
    public String  viewParserPage(){
    return "jsonxmlformater.html";
}

    @GetMapping("/learnings")
    public String  learnings(){
        return "learning.html";
    }

    @GetMapping("/blogs")
    public String  blogs(){
        return "blogs.html";
    }


    @GetMapping("/privacy")
    public String  privacy(){
        return "privacy.html";
    }

    @GetMapping("/contact")
    public String  contact(){
        return "contact-us.html";
    }

    @GetMapping("/json-parser")
    public String  jsonParser(){
        return "jsoneditor.html";
    }
    @GetMapping("/xml-parser")
    public String  xmlParser(){
        return "xmleditor.html";
    }

    @GetMapping("/json-xml-converter")
    public String  jsonXmlConverter(){
        return "xmleditor.html";
    }

    @GetMapping("/xml-json-converter")
    public String  xmlJSONParser(){
        return "xmleditor.html";
    }

    @GetMapping("/toml-converter")
    public String  tomlConverter(){
        return "tomconverter.html";
    }

    @GetMapping("/yaml-converter")
    public String  yamlConverter(){
        return "ymlconverter.html";
    }

    @GetMapping("/csv-converter")
    public String  csvConverter(){
        return "csvconverter.html";
    }

    @GetMapping("/health")
    public String  healthChecker(){
        return "health.html";
    }

    @GetMapping("/mapper")
    public String  objectMapper(){
        return "objectconverter.html";
    }
    @GetMapping("/429")
    public String tooManyRequests() {
        return "429.html";
    }
}
