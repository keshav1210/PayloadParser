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

@GetMapping("/payload-parser")
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
}
