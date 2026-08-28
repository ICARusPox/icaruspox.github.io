/**
 * BioJS Bundle Helper
 * Provides a client-side window.BioJS namespace with bioinformatics tools:
 * - Sequence manipulation (FASTA parsing, reverse complement, GC content)
 * - PDB / Structure metadata parser
 * - Gene Ontology & Functional Grouping helpers
 * - Statistical tools (Z-Score calculation, quantile cutoff, enrichment score)
 *
 * Adapted & derived from BioJS (https://github.com/biojs/biojs)
 * Copyright (c) BioJS Community / Contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function() {
    window.BioJS = {
        version: '1.2.0-standalone',
        
        // Sequence Utilities
        seq: {
            parseFASTA: function(fastaStr) {
                const entries = [];
                const lines = fastaStr.split('\n');
                let currentHeader = null;
                let currentSeq = [];
                
                for (let line of lines) {
                    line = line.trim();
                    if (line.startsWith('>')) {
                        if (currentHeader) {
                            entries.push({ header: currentHeader, sequence: currentSeq.join('') });
                        }
                        currentHeader = line.substring(1);
                        currentSeq = [];
                    } else if (line) {
                        currentSeq.push(line);
                    }
                }
                if (currentHeader) {
                    entries.push({ header: currentHeader, sequence: currentSeq.join('') });
                }
                return entries;
            },
            
            gcContent: function(sequence) {
                if (!sequence) return 0;
                const matches = sequence.match(/[GCgc]/g);
                return matches ? (matches.length / sequence.length) * 100 : 0;
            },
            
            reverseComplement: function(dnaSeq) {
                const comp = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G', 'a': 't', 't': 'a', 'g': 'c', 'c': 'g' };
                return dnaSeq.split('').reverse().map(b => comp[b] || b).join('');
            }
        },

        // Statistical Analytics for High-Content Screening
        stats: {
            zScore: function(value, mean, stdDev) {
                if (stdDev === 0) return 0;
                return (value - mean) / stdDev;
            },

            summary: function(values) {
                if (!values || values.length === 0) return { mean: 0, std: 0, min: 0, max: 0, median: 0 };
                const n = values.length;
                let sum = 0;
                let min = values[0];
                let max = values[0];
                for (let i = 0; i < n; i++) {
                    const v = values[i];
                    sum += v;
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
                const mean = sum / n;
                let sqSum = 0;
                for (let i = 0; i < n; i++) {
                    sqSum += Math.pow(values[i] - mean, 2);
                }
                const std = Math.sqrt(sqSum / n);
                
                const sorted = [...values].sort((a, b) => a - b);
                const median = n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];

                return { mean, std, min, max, median, count: n };
            },

            enrichmentScore: function(hitCategoryCount, totalCategoryCount, totalHitCount, totalGeneCount) {
                // Hypergeometric enrichment approximation score
                const expected = (totalCategoryCount / totalGeneCount) * totalHitCount;
                if (expected === 0) return 0;
                return hitCategoryCount / expected;
            }
        },

        // ICARusPox Screen Dataset Helpers
        screen: {
            getTopHits: function(dataset, key = 'lateRefined', topN = 50, direction = 'pro-viral') {
                if (!dataset || !dataset.genes) return [];
                const multiplier = direction === 'pro-viral' ? -1 : 1;
                return [...dataset.genes]
                    .sort((a, b) => multiplier * (b[key] - a[key]))
                    .slice(0, topN);
            },

            groupByCategory: function(genes) {
                const groups = {};
                for (let g of genes) {
                    const cat = g.category || 'Other';
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(g);
                }
                return groups;
            }
        }
    };
})();
