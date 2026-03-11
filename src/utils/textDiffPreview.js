function splitLines(text = '') {
    return String(text ?? '')
        .replace(/\r\n/g, '\n')
        .split('\n');
}

function buildLcsMatrix(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            if (a[i - 1] === b[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1] + 1;
            } else {
                matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
            }
        }
    }

    return matrix;
}

/**
 * 构建按行展示的差异结果。
 * type: context | add | remove
 */
export function buildLineDiff(beforeText = '', afterText = '', maxLines = 260) {
    const beforeLines = splitLines(beforeText);
    const afterLines = splitLines(afterText);
    const matrix = buildLcsMatrix(beforeLines, afterLines);

    const diff = [];
    let i = beforeLines.length;
    let j = afterLines.length;

    while (i > 0 && j > 0) {
        if (beforeLines[i - 1] === afterLines[j - 1]) {
            diff.push({ type: 'context', text: beforeLines[i - 1] });
            i--;
            j--;
        } else if (matrix[i - 1][j] >= matrix[i][j - 1]) {
            diff.push({ type: 'remove', text: beforeLines[i - 1] });
            i--;
        } else {
            diff.push({ type: 'add', text: afterLines[j - 1] });
            j--;
        }
    }

    while (i > 0) {
        diff.push({ type: 'remove', text: beforeLines[i - 1] });
        i--;
    }

    while (j > 0) {
        diff.push({ type: 'add', text: afterLines[j - 1] });
        j--;
    }

    const ordered = diff.reverse();
    if (ordered.length <= maxLines) {
        return {
            lines: ordered,
            truncated: false,
            total: ordered.length,
        };
    }

    return {
        lines: ordered.slice(0, maxLines),
        truncated: true,
        total: ordered.length,
    };
}

export function summarizeLineDiff(lineDiff = { lines: [] }) {
    const summary = {
        add: 0,
        remove: 0,
        context: 0,
    };

    (lineDiff.lines || []).forEach((item) => {
        if (item.type === 'add') summary.add += 1;
        else if (item.type === 'remove') summary.remove += 1;
        else summary.context += 1;
    });

    return summary;
}
