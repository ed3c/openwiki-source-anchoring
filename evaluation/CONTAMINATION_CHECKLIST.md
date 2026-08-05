# Contamination Checklist

For each run verify that:

- the source snapshot contains no candidate output or review transcript;
- the source-only task author cannot read any generated wiki or prior result;
- the wiki-only answerer cannot read source, answer keys, other candidates, or findings;
- the judge cannot see arm identity, aggregate totals, anchor rates, or prior judge output;
- the implementation executor receives exactly one anonymous wiki;
- no candidate uses a spent task split to guide generation;
- all candidates use the same source commit and measured denominator;
- inherited hand-written pages are declared and treated consistently;
- output paths, symlinks, copied text, and anchors do not cross candidate boundaries.
