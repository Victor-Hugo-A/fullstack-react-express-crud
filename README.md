# Sistema de documentos e análises

Aplicação local com API em Express e SQLite e interface em HTML, CSS e JavaScript. O sistema reúne contratos, projetos, identidades, gráficos e perfil de usuário. O frontend usa Bootstrap e Chart.js por CDN; não há React neste repositório.

## Pré-requisitos

- `node.exe` extraído do ZIP (Node.js 20.17+)
- `BackEnd/node_modules` já presente e compatível com essa versão do Node, pois a API usa Express, SQLite e outras bibliotecas
- Portas 3000 (API) e 5500 (frontend) livres
- Acesso à internet para carregar as bibliotecas usadas por CDN nas páginas

Não é necessário instalar pacotes para iniciar esta cópia do projeto. Os comandos abaixo chamam o Node portátil diretamente; substitua o caminho de exemplo pelo caminho real do seu `node.exe`.

## Preparação

No PowerShell, na raiz do projeto:

```powershell
$nodeExe = 'C:\caminho\para\node.exe'
if (-not (Test-Path .\BackEnd\.env)) { Copy-Item .\BackEnd\.env.example .\BackEnd\.env }
```

Edite `BackEnd/.env` e substitua `SECRET_KEY` e `SESSION_SECRET` por valores aleatórios distintos e longos. O arquivo local fica fora do Git. O banco SQLite e as pastas de dados/uploads são criados ou usados pelo backend na pasta `BackEnd`.

## Executar os dois no mesmo terminal

```powershell
& $nodeExe .\scripts\dev.js
```

O comando inicia API e servidor estático juntos. Abra http://localhost:5500/FrontEnd/login.html (ou http://localhost:5500, que redireciona para o login). O servidor estático publica somente a pasta `FrontEnd`; os arquivos do `BackEnd`, inclusive `.env`, não ficam acessíveis por essa porta. Pare os dois com Ctrl+C.

### Executar pelo WebStorm

Em **Run | Edit Configurations**, selecione **Portal - front e back** (tipo **Node.js**) e clique em **Run**. A configuração em `.run/Portal - front e back.run.xml` usa o Node portátil em `Downloads/node-v24.21.0-win-x64/node-v24.21.0-win-x64` e executa `scripts/dev.js` diretamente, sem chamar npm. Se você mover a pasta do Node, atualize o campo **Node runtime** nessa configuração. Depois, abra http://localhost:5500/FrontEnd/login.html. Use **Stop** no WebStorm para encerrar os dois servidores.

As configurações em `.run/` são locais desta máquina e ficam fora do Git porque guardam o caminho pessoal do Node. Em outro computador, configure o Node no WebStorm ou use os comandos acima com o caminho do `node.exe` daquele computador.

## Executar separadamente

Terminal 1, na raiz:

```powershell
$nodeExe = 'C:\caminho\para\node.exe'
& $nodeExe .\scripts\run-back.js
```

Terminal 2, na raiz:

```powershell
$nodeExe = 'C:\caminho\para\node.exe'
& $nodeExe .\scripts\serve-front.js
```

A API responde em http://localhost:3000/health e o frontend em http://localhost:5500/FrontEnd/login.html. O JavaScript do frontend está configurado para chamar a API na porta 3000.

## Redefinir senha de um cadastro local

As senhas do sistema são armazenadas como hash; não é possível consultar a senha antiga. Este projeto ainda não envia links de recuperação por e-mail. Para redefinir um cadastro do banco **local** usando o e-mail já registrado, pare os servidores e selecione **Redefinir senha local** em **Run | Edit Configurations** no WebStorm. Clique em **Run**, digite o e-mail no console e pressione Enter. O script mostra o **nome de usuário** e uma **senha temporária** uma única vez. Entre com esses dados em http://localhost:5500/FrontEnd/login.html e troque a senha em **Perfil**. Esse procedimento é administrativo e exige acesso ao arquivo local `BackEnd/database.sqlite`.

Pelo terminal, com o Node portátil:

```powershell
& $nodeExe .\scripts\reset-local-password.js
```

Para executar os testes de autenticação em um banco temporário:

```powershell
& $nodeExe --test .\BackEnd\test\server.test.js
```

O login principal usa os usuários do SQLite. As rotas experimentais `/seguro` e `/logout` usam Keycloak em localhost:8080 e exigem uma instância configurada separadamente.

## Estrutura

- `BackEnd/server.js`: rotas HTTP, autenticação e uploads.
- `BackEnd/database.js`: SQLite e repositório de usuários.
- `FrontEnd/login.html`: entrada e cadastro.
- `FrontEnd/Sistema`, `Documentos`, `Dashboard`, `Análises` e `Perfil`: páginas da interface.

## Dados locais e Git

`BackEnd/.env`, bancos SQLite, `BackEnd/data`, `BackEnd/uploads`, `node_modules` e `.run/` são ignorados nos próximos commits. Se algum dado sensível já foi publicado, removê-lo do índice do Git não apaga cópias do histórico remoto. Troque imediatamente chaves e senhas reais que tenham sido expostas. A limpeza do histórico exige uma operação separada e coordenada com quem já clonou o repositório.
