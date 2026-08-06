#!/usr/bin/env bash

# Usage: ./update_dataset.sh [path_to_tsv_file]
# If no argument is provided, defaults to assets/ICARusPox_web_resource_table.tsv

INPUT_TSV="${1:-assets/ICARusPox_web_resource_table.tsv}"
OUTPUT_JS="js/dataset.js"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

if [ ! -f "$INPUT_TSV" ]; then
    echo "Error: TSV file '$INPUT_TSV' not found!"
    exit 1
fi

echo "Updating $OUTPUT_JS from $INPUT_TSV..."

python3 -c "
import pandas as pd
import json
import sys

tsv_path = '$INPUT_TSV'
out_path = '$OUTPUT_JS'

try:
    df = pd.read_csv(tsv_path, sep='\t')
    required_cols = [
        'Name', 
        'early_unrefined_intensity', 
        'early_refined_intensity', 
        'late_unrefined_intensity', 
        'late_refined_intensity', 
        'cell_count', 
        'Cellular function'
    ]
    for col in required_cols:
        if col not in df.columns:
            raise KeyError(f'Missing required column in TSV: {col}')

    lines = ['window.RAW_GENE_DATA = [']
    count = 0

    for idx, row in df.iterrows():
        name = str(row['Name']).strip()
        if not name or name.lower() == 'nan':
            continue
        
        eu = round(float(row['early_unrefined_intensity']), 4)
        er = round(float(row['early_refined_intensity']), 4)
        lu = round(float(row['late_unrefined_intensity']), 4)
        lr = round(float(row['late_refined_intensity']), 4)
        cc = round(float(row['cell_count']), 4)
        cat = str(row['Cellular function']).strip() if pd.notnull(row['Cellular function']) else 'Other'
        
        row_json = json.dumps([name, eu, er, lu, lr, cc, cat])
        lines.append('  ' + row_json + ',')
        count += 1

    lines.append('];')

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')

    print(f'Successfully compiled {count:,} gene records into {out_path}')

except Exception as e:
    print(f'Error compiling TSV: {e}', file=sys.stderr)
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    echo "Dataset update completed successfully!"
else
    echo "Dataset update failed."
    exit 1
fi
