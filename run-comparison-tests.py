#!/usr/bin/env python3
"""
Comprehensive test comparing ilka/zyn and rag systems
NO CODE CHANGES - READ-ONLY TESTING
"""

import requests
import json
import time
from datetime import datetime

ILKA_WORKER = "https://ilka.eebehuur13.workers.dev"
RAG_WORKER = "https://rag-worker.eebehuur13.workers.dev"
USER_ID = "test-comparison-user"

# Test questions covering different complexity levels
TEST_QUESTIONS = [
    {
        "id": "q1_simple_fact",
        "question": "What is the National Education Policy 2020?",
        "type": "simple_factual",
        "expected": "Should provide basic definition/overview"
    },
    {
        "id": "q2_specific_detail",
        "question": "What are the key recommendations for Early Childhood Care and Education?",
        "type": "specific_section",
        "expected": "Should cite specific recommendations from ECCE section"
    },
    {
        "id": "q3_comparative",
        "question": "How does NEP 2020 propose to restructure school education compared to the previous system?",
        "type": "comparative_analysis",
        "expected": "Should compare 10+2 structure with new 5+3+3+4 structure"
    },
    {
        "id": "q4_multi_section",
        "question": "What role do teachers play in implementing the new curriculum framework?",
        "type": "multi_section",
        "expected": "Should pull from both Teachers and Curriculum sections"
    },
    {
        "id": "q5_numerical",
        "question": "What are the target years and goals mentioned in NEP 2020?",
        "type": "numerical_data",
        "expected": "Should extract specific years and targets"
    },
    {
        "id": "q6_complex",
        "question": "How does NEP 2020 address equitable and inclusive education for disadvantaged groups?",
        "type": "complex_topic",
        "expected": "Should synthesize from multiple sections about SEDGs, gender, etc."
    }
]

def upload_to_ilka(file_path):
    """Upload NEP2020.txt to ilka"""
    print("=" * 80)
    print("UPLOADING NEP2020.txt TO ILKA/ZYN")
    print("=" * 80)
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        response = requests.post(
            f"{ILKA_WORKER}/upload",
            json={
                "file_name": "NEP2020.txt",
                "content": content,
                "user_id": USER_ID
            },
            timeout=30
        )
        
        result = response.json()
        print(f"Upload Response: {json.dumps(result, indent=2)}")
        
        if response.status_code == 201:
            doc_id = result.get('document_id')
            print(f"\n✓ Upload successful! Document ID: {doc_id}")
            print(f"Expected processing time: ~15-20 seconds")
            return doc_id
        else:
            print(f"✗ Upload failed: {result}")
            return None
            
    except Exception as e:
        print(f"✗ Upload error: {e}")
        return None

def check_ilka_status(doc_id):
    """Check document processing status in ilka"""
    print(f"\nChecking status for document: {doc_id}")
    
    max_attempts = 40  # 40 * 5 = 200 seconds max wait
    for attempt in range(max_attempts):
        try:
            response = requests.get(f"{ILKA_WORKER}/status/{doc_id}", timeout=10)
            status_data = response.json()
            
            status = status_data.get('status', 'unknown')
            print(f"Attempt {attempt + 1}/{max_attempts}: Status = {status}")
            
            if status == 'ready':
                print("✓ Document is ready!")
                return True
            elif status == 'failed':
                print(f"✗ Document processing failed: {status_data}")
                return False
            
            time.sleep(5)
            
        except Exception as e:
            print(f"Status check error: {e}")
            time.sleep(5)
    
    print("✗ Timeout waiting for document to be ready")
    return False

def test_rag_system(file_id, question):
    """Test RAG system with a question"""
    try:
        response = requests.post(
            f"{RAG_WORKER}/api/chat",
            json={
                "message": question,
                "fileId": file_id,
                "methodId": "agr/baseline"  # Using AGR baseline
            },
            timeout=30
        )
        
        return {
            "success": True,
            "response": response.json(),
            "status_code": response.status_code
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def test_ilka_system(question):
    """Test ilka system with a question"""
    try:
        response = requests.post(
            f"{ILKA_WORKER}/query",
            json={
                "query": question,
                "user_id": USER_ID,
                "methods": ["method1", "method2", "method3", "method4"]  # Test all methods
            },
            timeout=60
        )
        
        return {
            "success": True,
            "response": response.json(),
            "status_code": response.status_code
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def analyze_answer_quality(question_info, rag_result, ilka_result):
    """Analyze and compare answer quality"""
    analysis = {
        "question": question_info["question"],
        "type": question_info["type"],
        "timestamp": datetime.now().isoformat()
    }
    
    # RAG Analysis
    if rag_result["success"]:
        rag_data = rag_result["response"]
        analysis["rag"] = {
            "answer_length": len(rag_data.get("answer", "")),
            "citations_count": len(rag_data.get("sources", [])),
            "has_answer": bool(rag_data.get("answer")),
            "metadata": rag_data.get("metadata", {})
        }
    else:
        analysis["rag"] = {"error": rag_result.get("error")}
    
    # Ilka Analysis
    if ilka_result["success"]:
        ilka_data = ilka_result["response"]
        answers = ilka_data.get("answers", [])
        analysis["ilka"] = {
            "methods_count": len(answers),
            "methods": []
        }
        
        for answer in answers:
            analysis["ilka"]["methods"].append({
                "method": answer.get("method"),
                "answer_length": len(answer.get("text", "")),
                "citations_count": len(answer.get("citations", [])),
                "confidence": answer.get("confidence"),
                "latency_ms": answer.get("latency_ms")
            })
    else:
        analysis["ilka"] = {"error": ilka_result.get("error")}
    
    return analysis

def main():
    print("=" * 80)
    print("ILKA/ZYN vs RAG SYSTEM COMPARISON TEST")
    print("=" * 80)
    print(f"Timestamp: {datetime.now()}")
    print(f"User ID: {USER_ID}")
    print()
    
    # Step 1: Upload to ilka
    nep_file_path = "/Users/harishadithya/ilka/NEP2020.txt"
    doc_id = upload_to_ilka(nep_file_path)
    
    if not doc_id:
        print("\n✗ Cannot proceed without successful upload")
        return
    
    # Step 2: Wait for processing
    print("\n" + "=" * 80)
    print("WAITING FOR ILKA/ZYN TO FINISH PROCESSING")
    print("=" * 80)
    
    if not check_ilka_status(doc_id):
        print("\n⚠ Document not ready, but will try testing anyway...")
    
    # Step 3: Run comparison tests
    print("\n" + "=" * 80)
    print("RUNNING COMPARISON TESTS")
    print("=" * 80)
    
    rag_file_id = "25dec8fe-6220-4b86-bfbc-108a2d4f8b64"  # NEP file in RAG
    results = []
    
    for i, test_q in enumerate(TEST_QUESTIONS, 1):
        print(f"\n{'=' * 80}")
        print(f"TEST {i}/{len(TEST_QUESTIONS)}: {test_q['id']}")
        print(f"Question: {test_q['question']}")
        print(f"Type: {test_q['type']}")
        print(f"{'=' * 80}")
        
        print("\nTesting RAG system...")
        rag_result = test_rag_system(rag_file_id, test_q["question"])
        
        if rag_result["success"]:
            rag_answer = rag_result["response"].get("answer", "")
            print(f"✓ RAG answered (length: {len(rag_answer)} chars)")
            print(f"  Answer preview: {rag_answer[:200]}...")
        else:
            print(f"✗ RAG error: {rag_result.get('error')}")
        
        print("\nTesting ILKA/ZYN system...")
        ilka_result = test_ilka_system(test_q["question"])
        
        if ilka_result["success"]:
            answers = ilka_result["response"].get("answers", [])
            print(f"✓ ILKA answered with {len(answers)} methods")
            for ans in answers:
                method = ans.get("method")
                text = ans.get("text", "")
                print(f"  - {method}: {len(text)} chars")
        else:
            print(f"✗ ILKA error: {ilka_result.get('error')}")
        
        # Analyze
        analysis = analyze_answer_quality(test_q, rag_result, ilka_result)
        results.append(analysis)
        
        time.sleep(2)  # Be nice to the APIs
    
    # Step 4: Generate comparison report
    print("\n" + "=" * 80)
    print("COMPARISON REPORT")
    print("=" * 80)
    
    report_path = "/Users/harishadithya/ilka/COMPARISON_RESULTS.json"
    with open(report_path, 'w') as f:
        json.dump({
            "test_config": {
                "timestamp": datetime.now().isoformat(),
                "user_id": USER_ID,
                "document": "NEP2020.txt",
                "rag_file_id": rag_file_id,
                "ilka_doc_id": doc_id
            },
            "questions": TEST_QUESTIONS,
            "results": results
        }, f, indent=2)
    
    print(f"\n✓ Full results saved to: {report_path}")
    print("\nSummary:")
    
    for result in results:
        print(f"\n{result['question'][:60]}...")
        
        if "error" in result.get("rag", {}):
            print(f"  RAG: ERROR - {result['rag']['error']}")
        else:
            rag = result.get("rag", {})
            print(f"  RAG: {rag.get('answer_length', 0)} chars, {rag.get('citations_count', 0)} citations")
        
        if "error" in result.get("ilka", {}):
            print(f"  ILKA: ERROR - {result['ilka']['error']}")
        else:
            ilka = result.get("ilka", {})
            methods_count = ilka.get('methods_count', 0)
            print(f"  ILKA: {methods_count} methods tested")
            for method in ilka.get('methods', []):
                print(f"    - {method['method']}: {method['answer_length']} chars, {method['citations_count']} citations")

if __name__ == "__main__":
    main()
