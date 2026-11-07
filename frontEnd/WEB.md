# Usar o Vida+ no navegador

Com o servidor em execução, abra http://localhost:8082 no Chrome ou Edge deste computador.

Para iniciar novamente, execute na pasta `frontEnd`:

```powershell
npm run web
```

Mantenha o terminal aberto enquanto usa o aplicativo. Os dados locais ficam no SQLite do navegador. Use sempre o mesmo navegador e endereço para conservar a sessão e os dados locais. O Supabase está configurado no `.env` local.

## Testes realizados

O fluxo automatizado no Chrome passou no servidor web: rejeição de data inválida, cadastro, busca, filtros, consulta da bula, edição, persistência no SQLite após recarregar com a nuvem bloqueada, sincronização ao reconectar e exclusão. Os registros temporários do teste foram removidos do Supabase.

Para repetir o teste no servidor já aberto:

```powershell
$env:E2E_BASE_URL = 'http://localhost:8082'
npm run test:e2e
```

O teste cria uma sessão anônima própria. Não acessa os dados da sessão usada manualmente no navegador. As contas anônimas de teste permanecem em Authentication > Users.
