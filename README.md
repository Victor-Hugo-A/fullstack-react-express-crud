# Sistema de documentos e análises

Aplicação local com API em Express e SQLite e interface em HTML, CSS e JavaScript. O sistema reúne contratos, projetos, identidades, gráficos e perfil de usuário. O frontend usa Bootstrap e Chart.js por CDN; não há React neste repositório.

## Pré-requisitos

- Node.js 20.17+ e npm
- Portas 3000 (API) e 5500 (frontend) livres
- Acesso à internet para carregar as bibliotecas usadas por CDN nas páginas

No PowerShell do Windows, use `npm.cmd` se a política de execução bloquear `npm.ps1`.

## Preparação

Na raiz do projeto:

```powershell
npm.cmd ci
npm.cmd ci --prefix BackEnd
Copy-Item BackEnd/.env.example BackEnd/.env
```

Edite `BackEnd/.env` e substitua `SECRET_KEY` e `SESSION_SECRET` por valores aleatórios distintos e longos. O arquivo local fica fora do Git. O banco SQLite e as pastas de dados/uploads são criados ou usados pelo backend na pasta `BackEnd`.

## Executar os dois no mesmo terminal

```powershell
npm.cmd run dev
```

O comando inicia API e servidor estático juntos. Abra http://localhost:5500/FrontEnd/login.html. Pare os dois com Ctrl+C.

## Executar separadamente

Terminal 1, na raiz:

```powershell
npm.cmd run back
```

Terminal 2, na raiz:

```powershell
npm.cmd run front
```

A API responde em http://localhost:3000/health e o frontend em http://localhost:5500/FrontEnd/login.html. O JavaScript do frontend está configurado para chamar a API na porta 3000.

Para executar os testes de autenticação em um banco temporário:

```powershell
npm.cmd test --prefix BackEnd
```

O login principal usa os usuários do SQLite. As rotas experimentais `/seguro` e `/logout` usam Keycloak em localhost:8080 e exigem uma instância configurada separadamente.

## Estrutura

- `BackEnd/server.js`: rotas HTTP, autenticação e uploads.
- `BackEnd/database.js`: SQLite e repositório de usuários.
- `FrontEnd/login.html`: entrada e cadastro.
- `FrontEnd/Sistema`, `Documentos`, `Dashboard`, `Análises` e `Perfil`: páginas da interface.

## Dados locais e Git

`BackEnd/.env`, bancos SQLite, `BackEnd/data`, `BackEnd/uploads` e `node_modules` são ignorados nos próximos commits. Se algum deles já foi publicado, removê-lo do índice do Git não apaga cópias do histórico remoto. Troque imediatamente chaves e senhas reais que tenham sido expostas. A limpeza do histórico exige uma operação separada e coordenada com quem já clonou o repositório.
