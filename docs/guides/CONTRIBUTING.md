# Contributing to Pageel CMS

Thank you for your interest in contributing to Pageel CMS! This guide will help you get started.

---

## Code of Conduct

- Be respectful to all contributors
- Use professional language
- Focus on improving the project

---

## Getting Started

### 1. Fork Repository

```bash
# Fork the repo on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/pageel-cms.git
cd pageel-cms
```

### 2. Setup Development Environment

```bash
cd core
npm install
npm run dev
```

### 3. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

---

## Development Guidelines

### Code Style

- **TypeScript:** Use strict mode
- **React:** Function components with hooks
- **Naming:** camelCase for variables, PascalCase for components
- **Comments:** JSDoc for public APIs

### Commit Messages

Format: `type: description`

```
feat: add WYSIWYG editor
fix: resolve image upload timeout
docs: update README
refactor: simplify git service adapter
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Add/update tests
- `chore` - Maintenance tasks

---

## Pull Request Process

1. **Update**: Ensure your branch is up-to-date with `main`
2. **Test**: Run the app and manually test your changes
3. **Document**: Update README if needed
4. **PR**: Create a Pull Request with clear description

### PR Template

```markdown
## Description
[Brief description of changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
[Describe how to test these changes]

## Screenshots (if applicable)
```

---

## Reporting Issues

When reporting bugs, please include:

1. **Browser version** (Chrome, Firefox, Safari, etc.)
2. **OS** (Windows, macOS, Linux)
3. **Steps to reproduce**
4. **Expected behavior**
5. **Actual behavior**
6. **Console errors** (if any)

---

## License

By contributing, you agree that your code will be licensed under the MIT License.

---

## Questions?

- Open an Issue on GitHub
- Email: dev@pageel.com
