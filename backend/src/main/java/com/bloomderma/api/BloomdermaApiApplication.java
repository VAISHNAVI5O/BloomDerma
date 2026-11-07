package com.bloomderma.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Entry point. @SpringBootApplication = configuration + component scan + auto-configuration (IoC container). */
@SpringBootApplication
public class BloomdermaApiApplication {
    public static void main(String[] args) { SpringApplication.run(BloomdermaApiApplication.class, args); }
}
