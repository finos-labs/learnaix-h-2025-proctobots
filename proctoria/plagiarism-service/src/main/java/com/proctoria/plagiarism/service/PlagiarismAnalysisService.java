package com.proctoria.plagiarism.service;

import org.springframework.stereotype.Service;
import java.util.UUID;
import java.util.Random;

@Service
public class PlagiarismAnalysisService {
    
    private final Random random = new Random();
    
    public String analyzeText(String text, String sessionId) {
        // Mock plagiarism analysis
        try {
            // Simulate processing time
            Thread.sleep(1000);
            
            // Generate random similarity score
            double similarityScore = random.nextDouble() * 100;
            
            System.out.println("Analyzed text for session: " + sessionId);
            System.out.println("Similarity score: " + similarityScore + "%");
            
            return "Analysis completed with " + similarityScore + "% similarity";
        } catch (Exception e) {
            System.err.println("Error during analysis: " + e.getMessage());
            return "Analysis failed";
        }
    }
    
    public String batchAnalyze(String[] texts, String sessionId) {
        // Mock batch analysis
        try {
            double totalSimilarity = 0;
            for (String text : texts) {
                double score = random.nextDouble() * 100;
                totalSimilarity += score;
            }
            
            double averageSimilarity = totalSimilarity / texts.length;
            
            System.out.println("Batch analysis for session: " + sessionId);
            System.out.println("Average similarity: " + averageSimilarity + "%");
            
            return "Batch analysis completed with average " + averageSimilarity + "% similarity";
        } catch (Exception e) {
            System.err.println("Error during batch analysis: " + e.getMessage());
            return "Batch analysis failed";
        }
    }
    
    public String getJobStatus(UUID jobId) {
        // Mock job status
        return "COMPLETED";
    }
    
    public double getSimilarityScore(UUID jobId) {
        // Mock similarity score
        return random.nextDouble() * 100;
    }
    
    public String[] getSupportedLanguages() {
        return new String[]{"java", "python", "javascript", "cpp", "csharp", "text"};
    }
    
    public String getDetailedReport(UUID jobId) {
        // Mock detailed report
        return "Detailed plagiarism report for job: " + jobId;
    }
}