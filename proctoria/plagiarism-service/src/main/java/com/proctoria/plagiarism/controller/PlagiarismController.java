package com.proctoria.plagiarism.controller;

import com.proctoria.plagiarism.service.PlagiarismAnalysisService;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/plagiarism")
public class PlagiarismController {
    
    private final PlagiarismAnalysisService plagiarismService;
    
    @Autowired
    public PlagiarismController(PlagiarismAnalysisService plagiarismService) {
        this.plagiarismService = plagiarismService;
    }
    
    @PostMapping("/analyze")
    public ResponseEntity<?> analyzePlagiarism(@RequestBody Map<String, Object> request) {
        try {
            String text = (String) request.get("text");
            String sessionId = (String) request.get("sessionId");
            
            // Mock response
            Map<String, Object> response = new HashMap<>();
            response.put("jobId", UUID.randomUUID().toString());
            response.put("status", "PROCESSING");
            response.put("message", "Analysis started successfully");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to start analysis: " + e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    @GetMapping("/status/{jobId}")
    public ResponseEntity<?> getJobStatus(@PathVariable String jobId) {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("jobId", jobId);
            response.put("status", "COMPLETED");
            response.put("progress", 100);
            response.put("similarityScore", 15.7);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to get job status: " + e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "OK");
        response.put("service", "Plagiarism Detection Service");
        return ResponseEntity.ok(response);
    }
}