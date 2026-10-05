<div align="center">

# Portal institucional SENAPPEN

**Um espaço único para organizar contratos, projetos, identidades e informações de gestão.**

<img src="docs/images/tela-login.png" alt="Tela de acesso do Portal institucional SENAPPEN" width="900">

</div>

<p align="center">
  <a href="#o-que-o-portal-oferece">Recursos</a> ·
  <a href="#primeiros-passos">Primeiros passos</a> ·
  <a href="#contas-e-permissões">Contas</a> ·
  <a href="#verificações">Verificações</a>
</p>

---

## O que o portal oferece

O Portal SENAPPEN reúne as informações usadas pela equipe em uma área protegida. Depois de entrar, cada pessoa pode consultar os registros autorizados, acompanhar os indicadores e manter seus dados atualizados.

| Área | O que é possível fazer |
| --- | --- |
| **Contratos** | Cadastrar, consultar, filtrar, ordenar, editar, visualizar e baixar contratos e documentos relacionados. |
| **Projetos** | Registrar projetos, responsáveis, prazos, situação e até cinco anexos por envio. |
| **Identidades** | Manter dados de identificação, endereço, perfil e fotografia. |
| **Dashboard e análises** | Acompanhar totais, distribuições e registros recentes; comparar informações por período. |
| **Perfil** | Atualizar departamento, cargo, CPF e senha. |

As listas de contratos, projetos e identidades mostram seis registros por página. Elas oferecem ordenação, filtros e mensagens claras quando não há resultados.

## Acesso e administração

Uma pessoa pode solicitar acesso pela própria tela inicial. A solicitação fica aguardando até que um administrador a aprove ou rejeite.

Administradores também podem:

- aprovar ou rejeitar solicitações de acesso;
- excluir registros e anexos quando necessário;
- sincronizar e limpar contratos;
- consultar o histórico de entradas, envios, alterações e exclusões.

O portal registra essas ações para facilitar o acompanhamento da operação.

## Primeiros passos

### Antes de iniciar

Tenha o Node.js 20 ou superior instalado e deixe livres as portas `3000` e `5500`.

### 1. Prepare a configuração local

Abra um terminal na raiz do projeto e instale as dependências:

```powershell
npm.cmd ci
cd BackEnd
npm.cmd ci
Copy-Item .env.example .env
cd ..
```

Abra `BackEnd/.env` e substitua `SECRET_KEY` e `SESSION_SECRET` por valores longos, aleatórios e diferentes. Esse arquivo contém informações privadas e não deve ser enviado ao repositório.

### 2. Inicie o portal

```powershell
npm.cmd run dev
```

| Endereço | Uso |
| --- | --- |
| [http://localhost:5500](http://localhost:5500) | Tela de acesso do portal. |
| [http://localhost:3000/health](http://localhost:3000/health) | Confirma se o serviço está disponível. |

Para encerrar, use `Ctrl+C` no terminal.

### 3. Crie a primeira conta administrativa

Cadastre uma conta pela tela de acesso. Com a API parada, execute:

```powershell
node .\scripts\manage-local-admin.js
```

Informe o e-mail da conta. O comando aprova a conta e concede a administração. Depois disso, inicie o portal novamente.

Para remover essa permissão, use:

```powershell
node .\scripts\manage-local-admin.js --revoke
```

## Cuidados com os dados

Os dados do portal ficam no banco local em `BackEnd/database.sqlite` e os documentos enviados ficam em `BackEnd/uploads/`.

Faça uma cópia desses dois locais antes de atualizar o sistema ou mover a instalação. Os contratos antigos encontrados em `BackEnd/data/contracts.json` são trazidos para o banco na primeira atualização, sem alterar o arquivo original.

## Segurança no uso diário

- A sessão fica protegida no navegador e termina ao sair do portal.
- Documentos e fotografias só são entregues para pessoas autenticadas.
- O sistema verifica formato, tipo e conteúdo dos arquivos antes de aceitá-los.
- Novas contas só entram após aprovação administrativa.
- O acesso tem limite de tentativas para reduzir tentativas de senha indevidas.

Ao publicar o portal em uma rede acessível, utilize HTTPS, configure o endereço público correto e mantenha cópias periódicas do banco e dos anexos.

## Verificações

O projeto possui verificações para garantir que as telas, os acessos, os anexos e as permissões continuem funcionando após uma alteração.

```powershell
# Verifica o sistema completo
npm.cmd test

# Executa somente as telas principais
npm.cmd test:e2e

# Verifica dependências com problemas altos ou críticos
npm.cmd run test:security
```

Na primeira execução das verificações de tela, instale o navegador necessário:

```powershell
npx.cmd playwright install chromium
```

Cada envio de alteração e solicitação de revisão no GitHub executa essas verificações automaticamente em [ci.yml](.github/workflows/ci.yml).

## Organização do projeto

```text
FrontEnd/       telas e recursos visuais do portal
BackEnd/        regras do sistema, dados, arquivos enviados e histórico
tests/e2e/      verificações das principais jornadas na interface
scripts/        comandos de inicialização e manutenção local
docs/images/    imagens usadas nesta documentação
```

Para quem precisa consultar a integração entre a interface e o serviço, a referência completa está em [BackEnd/openapi.yaml](BackEnd/openapi.yaml).
