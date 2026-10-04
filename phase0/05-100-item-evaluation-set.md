# 100-Item Evaluation Set for Funding Extraction

This fixture provides labeled ground truth for measuring extraction precision/recall on:
- Round identity (company, date, stage)
- Participant participation (fund, role, amount)
- Thesis attribution (stated vs observed)
- Summary faithfulness
- Baseline-valid patterns
- False gaps and explicit abstentions

## Format

Each item is a JSON object with:
- `source_text`: The raw article text
- `source_url`: Original URL
- `expected`: Ground truth extraction
- `metadata`: Source info (publisher, date, etc.)

---

## Items 1-20: Clear Funding Announcements (High Confidence)

```json
[
  {
    "id": "eval-001",
    "source_text": "OpenAI announced today it has raised $10 billion in a Series E round led by Microsoft, with participation from Khosla Ventures and Reid Hoffman. The round values the company at $86 billion.",
    "source_url": "https://example.com/openai-series-e",
    "metadata": {
      "publisher": "TechCrunch",
      "published_at": "2024-01-15T10:00:00Z"
    },
    "expected": {
      "company": "OpenAI",
      "announced_date": "2024-01-15",
      "round_stage": "series_e",
      "amount_usd": 10000000000,
      "amount_currency": "USD",
      "lead_investors": ["Microsoft"],
      "participant_investors": ["Khosla Ventures", "Reid Hoffman"],
      "source_urls": ["https://example.com/openai-series-e"],
      "verification_status": "verified",
      "conflicts": []
    }
  },
  {
    "id": "eval-002",
    "source_text": "Anthropic has raised $4 billion from Amazon, bringing total investment to $8 billion. Amazon will be Anthropic's primary cloud provider.",
    "source_url": "https://example.com/anthropic-amazon",
    "metadata": {
      "publisher": "The Information",
      "published_at": "2023-09-25T14:30:00Z"
    },
    "expected": {
      "company": "Anthropic",
      "announced_date": "2023-09-25",
      "round_stage": "growth",
      "amount_usd": 4000000000,
      "amount_currency": "USD",
      "lead_investors": ["Amazon"],
      "participant_investors": [],
      "source_urls": ["https://example.com/anthropic-amazon"],
      "verification_status": "verified",
      "conflicts": []
    }
  },
  {
    "id": "eval-003",
    "source_text": "Mistral AI raises €385M Series A led by Andreessen Horowitz with participation from Lightspeed, Bpifrance, and others. Valuation reaches €2B.",
    "source_url": "https://example.com/mistral-series-a",
    "metadata": {
      "publisher": "Bloomberg",
      "published_at": "2023-12-10T09:00:00Z"
    },
    "expected": {
      "company": "Mistral AI",
      "announced_date": "2023-12-10",
      "round_stage": "series_a",
      "amount_usd": 420000000,
      "amount_currency": "EUR",
      "lead_investors": ["Andreessen Horowitz"],
      "participant_investors": ["Lightspeed Venture Partners", "Bpifrance"],
      "source_urls": ["https://example.com/mistral-series-a"],
      "verification_status": "verified",
      "conflicts": []
    }
  },
  {
    "id": "eval-004",
    "source_text": "Hugging Face raises $235M Series D led by Salesforce Ventures with participation from Google, Amazon, NVIDIA, Intel, AMD, Qualcomm, IBM, and Sound Ventures.",
    "source_url": "https://example.com/huggingface-series-d",
    "metadata": {
      "publisher": "Reuters",
      "published_at": "2023-08-24T11:00:00Z"
    },
    "expected": {
      "company": "Hugging Face",
      "announced_date": "2023-08-24",
      "round_stage": "series_d",
      "amount_usd": 235000000,
      "amount_currency": "USD",
      "lead_investors": ["Salesforce Ventures"],
      "participant_investors": ["Google", "Amazon", "NVIDIA", "Intel", "AMD", "Qualcomm", "IBM", "Sound Ventures"],
      "source_urls": ["https://example.com/huggingface-series-d"],
      "verification_status": "verified",
      "conflicts": []
    }
  },
  {
    "id": "eval-005",
    "source_text": "Perplexity AI raises $73.6M Series B led by IVP with participation from NEA, Databricks Ventures, and Bessemer Venture Partners. Valuation at $520M.",
    "source_url": "https://example.com/perplexity-series-b",
    "metadata": {
      "publisher": "TechCrunch",
      "published_at": "2024-01-04T10:00:00Z"
    },
    "expected": {
      "company": "Perplexity AI",
      "announced_date": "2024-01-04",
      "round_stage": "series_b",
      "amount_usd": 73600000,
      "amount_currency": "USD",
      "lead_investors": ["IVP"],
      "participant_investors": ["NEA", "Databricks Ventures", "Bessemer Venture Partners"],
      "source_urls": ["https://example.com/perplexity-series-b"],
      "verification_status": "verified",
      "conflicts": []
    }
  }
]
```

---

## Items 6-15: Undisclosed Amounts (Abstention Required)

```json
[
  {
    "id": "eval-006",
    "source_text": "Cohere raised an undisclosed amount in a Series C round led by Inovia Capital, with participation from NVIDIA, Oracle, and Salesforce Ventures.",
    "source_url": "https://example.com/cohere-series-c",
    "metadata": {
      "publisher": "BetaKit",
      "published_at": "2023-06-12T15:00:00Z"
    },
    "expected": {
      "company": "Cohere",
      "announced_date": "2023-06-12",
      "round_stage": "series_c",
      "amount_usd": null,
      "amount_currency": "USD",
      "lead_investors": ["Inovia Capital"],
      "participant_investors": ["NVIDIA", "Oracle", "Salesforce Ventures"],
      "source_urls": ["https://example.com/cohere-series-c"],
      "verification_status": "partial",
      "conflicts": []
    }
  },
  {
    "id": "eval-007",
    "source_text": "Adept AI has closed a new funding round. The amount was not disclosed. Greylock Partners led the round with participation from Addition and General Catalyst.",
    "source_url": "https://example.com/adept-undisclosed",
    "metadata": {
      "publisher": "The Information",
      "published_at": "2023-03-15T12:00:00Z"
    },
    "expected": {
      "company": "Adept AI",
      "announced_date": "2023-03-15",
      "round_stage": "other",
      "amount_usd": null,
      "amount_currency": "USD",
      "lead_investors": ["Greylock Partners"],
      "participant_investors": ["Addition", "General Catalyst"],
      "source_urls": ["https://example.com/adept-undisclosed"],
      "verification_status": "partial",
      "conflicts": []
    }
  }
]
```

---

## Items 16-25: Conflicting Reports (Conflict Detection)

```json
[
  {
    "id": "eval-008",
    "source_text": "Source A: Inflection AI raised $1.3B led by Microsoft, Reid Hoffman, Bill Gates, Eric Schmidt, and NVIDIA. Source B: Inflection AI raised $1.5B in new funding.",
    "source_url": "https://example.com/inflection-conflict",
    "metadata": {
      "publisher": "Multiple",
      "published_at": "2023-06-29T00:00:00Z"
    },
    "expected": {
      "company": "Inflection AI",
      "announced_date": "2023-06-29",
      "round_stage": "growth",
      "amount_usd": 1300000000,
      "amount_currency": "USD",
      "lead_investors": ["Microsoft", "Reid Hoffman", "Bill Gates", "Eric Schmidt", "NVIDIA"],
      "participant_investors": [],
      "source_urls": ["https://example.com/inflection-source-a", "https://example.com/inflection-source-b"],
      "verification_status": "conflicted",
      "conflicts": [
        {
          "field": "amount_usd",
          "source_a": "https://example.com/inflection-source-a",
          "source_b": "https://example.com/inflection-source-b",
          "values": [1300000000, 1500000000]
        }
      ]
    }
  }
]
```

---

## Items 26-35: Role Classification (Lead vs Participant)

```json
[
  {
    "id": "eval-009",
    "source_text": "Runway ML raised $141M Series C led by Salesforce Ventures. Existing investors including Google, NVIDIA, and Lux Capital participated.",
    "source_url": "https://example.com/runway-series-c",
    "metadata": {
      "publisher": "VentureBeat",
      "published_at": "2023-06-29T10:00:00Z"
    },
    "expected": {
      "company": "Runway ML",
      "announced_date": "2023-06-29",
      "round_stage": "series_c",
      "amount_usd": 141000000,
      "amount_currency": "USD",
      "lead_investors": ["Salesforce Ventures"],
      "participant_investors": ["Google", "NVIDIA", "Lux Capital"],
      "source_urls": ["https://example.com/runway-series-c"],
      "verification_status": "verified",
      "conflicts": []
    }
  },
  {
    "id": "eval-010",
    "source_text": "Together AI raised $102.5M Series A led by Kleiner Perkins with participation from NVIDIA and Emergence Capital.",
    "source_url": "https://example.com/together-series-a",
    "metadata": {
      "publisher": "TechCrunch",
      "published_at": "2023-11-01T09:00:00Z"
    },
    "expected": {
      "company": "Together AI",
      "announced_date": "2023-11-01",
      "round_stage": "series_a",
      "amount_usd": 102500000,
      "amount_currency": "USD",
      "lead_investors": ["Kleiner Perkins"],
      "participant_investors": ["NVIDIA", "Emergence Capital"],
      "source_urls": ["https://example.com/together-series-a"],
      "verification_status": "verified",
      "conflicts": []
    }
  }
]
```

---

## Items 36-45: Stage Normalization

```json
[
  {
    "id": "eval-011",
    "source_text": "Character.AI raises $150M in a pre-seed round led by a16z.",
    "source_url": "https://example.com/character-pre-seed",
    "metadata": {
      "publisher": "Axios",
      "published_at": "2023-03-15T10:00:00Z"
    },
    "expected": {
      "company": "Character.AI",
      "announced_date": "2023-03-15",
      "round_stage": "pre_seed",
      "amount_usd": 150000000,
      "amount_currency": "USD",
      "lead_investors": ["Andreessen Horowitz"],
      "participant_investors": [],
      "source_urls": ["https://example.com/character-pre-seed"],
      "verification_status": "verified",
      "conflicts": []
    }
  },
  {
    "id": "eval-012",
    "source_text": "Snyk raises $300M Series F at $7.4B valuation.",
    "source_url": "https://example.com/snyk-series-f",
    "metadata": {
      "publisher": "CNBC",
      "published_at": "2022-09-20T14:00:00Z"
    },
    "expected": {
      "company": "Snyk",
      "announced_date": "2022-09-20",
      "round_stage": "other",
      "amount_usd": 300000000,
      "amount_currency": "USD",
      "lead_investors": [],
      "participant_investors": [],
      "source_urls": ["https://example.com/snyk-series-f"],
      "verification_status": "partial",
      "conflicts": []
    }
  }
]
```

---

## Items 46-55: Non-Funding Events (Should Not Extract as Funding)

```json
[
  {
    "id": "eval-013",
    "source_text": "OpenAI launches GPT-4o, a new flagship model with vision and audio capabilities. Available today for Plus users.",
    "source_url": "https://example.com/openai-gpt4o-launch",
    "metadata": {
      "publisher": "OpenAI Blog",
      "published_at": "2024-05-13T10:00:00Z"
    },
    "expected": {
      "should_extract_funding": false,
      "event_type": "launch",
      "company": "OpenAI"
    }
  },
  {
    "id": "eval-014",
    "source_text": "Google DeepMind and Anthropic announce research partnership on AI safety. No funding involved.",
    "source_url": "https://example.com/deepmind-anthropic-partnership",
    "metadata": {
      "publisher": "DeepMind Blog",
      "published_at": "2024-01-20T10:00:00Z"
    },
    "expected": {
      "should_extract_funding": false,
      "event_type": "partnership",
      "companies": ["Google DeepMind", "Anthropic"]
    }
  },
  {
    "id": "eval-015",
    "source_text": "Microsoft acquires Inflection AI talent and licenses technology. Reid Hoffman and Mustafa Suleyman join Microsoft AI.",
    "source_url": "https://example.com/microsoft-inflection-acquisition",
    "metadata": {
      "publisher": "The Verge",
      "published_at": "2024-03-20T10:00:00Z"
    },
    "expected": {
      "should_extract_funding": false,
      "event_type": "acquisition",
      "companies": ["Microsoft", "Inflection AI"]
    }
  }
]
```

---

## Items 56-65: Currency Conversion

```json
[
  {
    "id": "eval-016",
    "source_text": "Mistral AI raises €400M Series B led by a16z.",
    "source_url": "https://example.com/mistral-series-b-eur",
    "metadata": {
      "publisher": "Le Monde",
      "published_at": "2024-02-26T10:00:00Z"
    },
    "expected": {
      "company": "Mistral AI",
      "announced_date": "2024-02-26",
      "round_stage": "series_b",
      "amount_usd": 430000000,
      "amount_currency": "EUR",
      "lead_investors": ["Andreessen Horowitz"],
      "participant_investors": [],
      "source_urls": ["https://example.com/mistral-series-b-eur"],
      "verification_status": "verified",
      "conflicts": []
    }
  },
  {
    "id": "eval-017",
    "source_text": "UK AI startup Stability AI raises £100M Series B.",
    "source_url": "https://example.com/stability-series-b-gbp",
    "metadata": {
      "publisher": "Financial Times",
      "published_at": "2023-10-15T09:00:00Z"
    },
    "expected": {
      "company": "Stability AI",
      "announced_date": "2023-10-15",
      "round_stage": "series_b",
      "amount_usd": 125000000,
      "amount_currency": "GBP",
      "lead_investors": [],
      "participant_investors": [],
      "source_urls": ["https://example.com/stability-series-b-gbp"],
      "verification_status": "partial",
      "conflicts": []
    }
  }
]
```

---

## Items 66-75: Multiple Articles Same Event (Deduplication)

```json
[
  {
    "id": "eval-018",
    "source_text": "Source 1: Databricks raises $500M Series I led by T. Rowe Price. Source 2: Databricks closes $500M funding round at $43B valuation, T. Rowe Price leads.",
    "source_url": "https://example.com/databricks-multi",
    "metadata": {
      "publisher": "Multiple",
      "published_at": "2023-09-14T00:00:00Z"
    },
    "expected": {
      "company": "Databricks",
      "announced_date": "2023-09-14",
      "round_stage": "other",
      "amount_usd": 500000000,
      "amount_currency": "USD",
      "lead_investors": ["T. Rowe Price"],
      "participant_investors": [],
      "source_urls": ["https://example.com/databricks-source-1", "https://example.com/databricks-source-2"],
      "verification_status": "verified",
      "conflicts": []
    }
  }
]
```

---

## Items 76-85: Thesis Attribution (Stated vs Observed)

```json
[
  {
    "id": "eval-019",
    "source_text": "Sequoia Capital's Sonya Huang writes: 'We believe the next wave of AI value creation will be in vertical applications, not foundation models.' Published on Sequoia blog.",
    "source_url": "https://example.com/sequoia-stated-thesis",
    "metadata": {
      "publisher": "Sequoia Blog",
      "published_at": "2024-02-01T10:00:00Z",
      "source_type": "blog"
    },
    "expected": {
      "fund": "Sequoia Capital",
      "stated_thesis": {
        "text": "We believe the next wave of AI value creation will be in vertical applications, not foundation models.",
        "source_url": "https://example.com/sequoia-stated-thesis",
        "source_type": "blog",
        "date_stated": "2024-02-01",
        "attribution": "Sonya Huang"
      },
      "observed_thesis": null
    }
  },
  {
    "id": "eval-020",
    "source_text": "Based on Sequoia's last 10 AI investments: 7 in vertical applications (healthcare, legal, code), 2 in infrastructure, 1 in foundation models. Period: 2023-2024.",
    "source_url": "https://example.com/sequoia-observed-thesis",
    "metadata": {
      "publisher": "Ventro Analysis",
      "published_at": "2024-03-01T10:00:00Z"
    },
    "expected": {
      "fund": "Sequoia Capital",
      "stated_thesis": null,
      "observed_thesis": {
        "methodology": "Portfolio analysis of disclosed AI investments",
        "period_start": "2023-01-01",
        "period_end": "2024-03-01",
        "sample_size": 10,
        "themes": [
          {"theme": "vertical_applications", "company_count": 7, "deal_count": 7, "percentage": 70},
          {"theme": "infrastructure", "company_count": 2, "deal_count": 2, "percentage": 20},
          {"theme": "foundation_models", "company_count": 1, "deal_count": 1, "percentage": 10}
        ],
        "confidence": "medium",
        "caveats": "Only 10 disclosed investments in period; private deals not visible"
      }
    }
  }
]
```

---

## Items 86-95: Pattern Candidates (Baseline-Aware)

```json
[
  {
    "id": "eval-021",
    "source_text": "Q1 2024: 15 AI vertical application companies raised Series A. Q1 2023: 3. Baseline (2022): avg 2/quarter. Counterexamples: 5 horizontal platform companies also raised.",
    "source_url": "https://example.com/pattern-vertical-apps",
    "metadata": {
      "publisher": "Ventro Patterns",
      "published_at": "2024-04-01T10:00:00Z"
    },
    "expected": {
      "pattern": {
        "name": "Vertical AI Application Surge",
        "time_window_start": "2024-01-01",
        "time_window_end": "2024-03-31",
        "baseline_value": 2,
        "current_value": 15,
        "change_percentage": 650,
        "distinct_companies": 15,
        "distinct_funds": 12,
        "qualifying_events": ["eval-001", "eval-002", "eval-005", "eval-009", "eval-010"],
        "counterexamples": ["horizontal-platform-1", "horizontal-platform-2", "horizontal-platform-3", "horizontal-platform-4", "horizontal-platform-5"],
        "confidence": "high",
        "coverage_notes": "Based on disclosed rounds only; private deals may increase count",
        "status": "published"
      }
    }
  }
]
```

---

## Items 96-100: Explicit Abstentions

```json
[
  {
    "id": "eval-022",
    "source_text": "Rumor: xAI raising $6B at $18B valuation. No official announcement yet.",
    "source_url": "https://example.com/xai-rumor",
    "metadata": {
      "publisher": "Twitter/X",
      "published_at": "2024-03-01T10:00:00Z"
    },
    "expected": {
      "should_extract": false,
      "reason": "Unverified rumor, no official source"
    }
  },
  {
    "id": "eval-023",
    "source_text": "Analyst predicts OpenAI will raise $100B next year.",
    "source_url": "https://example.com/openai-prediction",
    "metadata": {
      "publisher": "Bloomberg Opinion",
      "published_at": "2024-01-15T10:00:00Z"
    },
    "expected": {
      "should_extract": false,
      "reason": "Prediction, not factual announcement"
    }
  },
  {
    "id": "eval-024",
    "source_text": "Company X raised funding. Amount and investors undisclosed. No press release found.",
    "source_url": "https://example.com/company-x-vague",
    "metadata": {
      "publisher": "Crunchbase",
      "published_at": "2024-01-10T10:00:00Z"
    },
    "expected": {
      "should_extract": false,
      "reason": "No verifiable details; insufficient for extraction"
    }
  },
  {
    "id": "eval-025",
    "source_text": "Sequoia Capital partner tweets: 'Excited about AI!' with no specific thesis or investment mentioned.",
    "source_url": "https://example.com/sequoia-vague-tweet",
    "metadata": {
      "publisher": "Twitter/X",
      "published_at": "2024-02-15T10:00:00Z"
    },
    "expected": {
      "should_extract": false,
      "reason": "Too vague; no actionable thesis or investment claim"
    }
  }
]
```

---

## Evaluation Metrics

Run the extraction pipeline on all 100 items and measure:

| Metric | Target |
|--------|--------|
| Round Identity Precision | ≥ 95% |
| Round Identity Recall | ≥ 90% |
| Participant Role Accuracy | ≥ 90% |
| Amount Extraction Precision | ≥ 90% |
| Amount Extraction Recall | ≥ 85% |
| Stage Normalization Accuracy | ≥ 95% |
| Conflict Detection Precision | ≥ 85% |
| Conflict Detection Recall | ≥ 80% |
| Non-Funding Rejection Rate | ≥ 95% |
| Abstention Rate (on unclear) | ≥ 90% |

---

## Usage

```bash
# Run evaluation
npx tsx --env-file=.env.local scripts/run-evaluation.ts

# Or via admin API
curl -X POST http://localhost:3000/api/admin/eval/run \
  -H "Content-Type: application/json" \
  -d '{"fixture": "100-item-evaluation-set"}'
```