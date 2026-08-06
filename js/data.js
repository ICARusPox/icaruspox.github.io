export function getParsedDataset() {
    const raw = window.RAW_GENE_DATA;
    if (!raw || !Array.isArray(raw)) {
        console.error('RAW_GENE_DATA is missing or empty.');
        return { genes: [], categories: [] };
    }

    const parsedRows = [];
    const categorySet = new Set();

    for (let i = 0; i < raw.length; i++) {
        const item = raw[i];
        const name = item[0];
        if (!name) continue;

        const earlyUnrefined = item[1] || 0;
        const earlyRefined = item[2] || 0;
        const lateUnrefined = item[3] || 0;
        const lateRefined = item[4] || 0;
        const cellCount = item[5] || 0;
        const category = item[6] || 'Other';

        categorySet.add(category);

        parsedRows.push({
            gene: name,
            category: category,
            earlyUnrefined,
            earlyRefined,
            lateUnrefined,
            lateRefined,
            cellCount
        });
    }

    const categories = Array.from(categorySet).sort();

    return {
        genes: parsedRows,
        categories: categories
    };
}
