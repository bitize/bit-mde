module.exports = {
  trailingComma: 'es5',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  // O repo não tem .gitattributes e os devs usam Windows com core.autocrlf=true,
  // então o working tree fica em CRLF enquanto a CI (Linux) vê LF. Com o padrão
  // 'lf' do Prettier, `--check` acusaria todos os arquivos localmente e nenhum
  // na CI. 'auto' aceita o final de linha que o arquivo já tem.
  endOfLine: 'auto',
}
