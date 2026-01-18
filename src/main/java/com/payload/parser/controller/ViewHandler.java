package com.payload.parser.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping
public class ViewHandler {

@GetMapping("/payload-parser")
    public String  viewHomePage(){
    return "jsonxmlformater.html";
}
}
