const fs = require('fs');
const path = require('path');

const fp = path.resolve(__dirname, '..', '..', 'crates', 'screener', 'src', 'sslang', 'tokenizer.rs');
let c = fs.readFileSync(fp, 'utf8');

// Find the identifier section and add AND/OR handling
const idSection = `            let s = std::str::from_utf8(&src[start..i])
                .map_err(|_| SSLangError::new("非法标识符编码"))?;
            tokens.push(Token::Id(***********()));
            continue;`;

const newSection = `            let s = std::str::from_utf8(&src[start..i])
                .map_err(|_| SSLangError::new("非法标识符编码"))?;
            // Treat AND/OR as logical operators (case-insensitive)
            let upper = s.to_uppercase();
            if upper == "AND" {
                tokens.push(Token::Op("&&".to_string()));
            } else if upper == "OR" {
                tokens.push(Token::Op("||".to_string()));
            } else {
                tokens.push(Token::Id(***********()));
            }
            continue;`;

if (c.includes(idSection)) {
    c = c.replace(idSection, newSection);
    fs.writeFileSync(fp, c);
    console.log('Added AND/OR support to Rust tokenizer');
} else {
    console.log('Could not find identifier section');
}
