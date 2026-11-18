"""Publish already-built installers and update manifests using saved Git credentials."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.parse
import urllib.request

version = json.loads(Path('package.json').read_text())['version']
files = []
for role, title in [('client', 'Client'), ('admin', 'Admin')]:
    directory = Path('release') / role
    installer = directory / f'Sip Happens {title} Setup {version}.exe'
    files += [installer, Path(str(installer) + '.blockmap'), directory / f'{role}.yml']
for path in files:
    if not path.is_file():
        raise SystemExit(f'Missing release file: {path}')
if subprocess.check_output(['git', 'status', '--porcelain'], text=True).strip():
    raise SystemExit('Commit changes before publishing.')
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
remote = subprocess.check_output(['git', 'ls-remote', 'origin', 'refs/heads/main'], text=True)
if remote.split()[0] != sha:
    raise SystemExit('Push the release commit to main before publishing.')
result = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n', text=True, capture_output=True, env={**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'GCM_INTERACTIVE': 'never'})
credentials = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
token = credentials.get('password')
if result.returncode or not token:
    raise SystemExit('Sign in using Git Credential Manager before publishing.')
base = 'https://api.github.com/repos/lloydaarn/sip-happens'

def request(url, method='GET', data=None, content='application/json'):
    req = urllib.request.Request(url, data=data, method=method, headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': content, 'User-Agent': 'Sip-Happens-release', 'X-GitHub-Api-Version': '2022-11-28'})
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f'GitHub API returned HTTP {error.code}; incomplete release stays draft.')

releases = request(base + '/releases')
if any(r['tag_name'] == 'v' + version for r in releases):
    raise SystemExit('This release already exists. Inspect it before retrying; no assets overwritten.')
release = request(base + '/releases', 'POST', json.dumps({'tag_name': 'v' + version, 'target_commitish': sha, 'name': 'Sip Happens ' + version, 'draft': True, 'prerelease': False, 'body': 'Adds four user-supplied water memes as image-only slides with no added captions, preserves their full aspect ratios and embedded text, and replaces the headache photograph with the supplied image. Slideshow navigation is now in the left panel.\n\nInstall this version manually once if you have 0.1.0. Future stable releases download automatically and install on tray Exit or Restart and install. Enable minimized startup in each app.\n\nInstallers are unsigned. Hardware and two-PC acceptance testing remains pending.'}).encode())
print('Created draft release', flush=True)
checksums = []
def upload(name, data):
    asset = request(release['upload_url'].split('{')[0] + '?name=' + urllib.parse.quote(name), 'POST', data, 'application/octet-stream')
    if asset['size'] != len(data):
        raise SystemExit('Asset size mismatch; release remains draft.')
    print('Uploaded ' + name, flush=True)
for path in files:
    data = path.read_bytes()
    name = path.name.replace(' ', '-')
    checksums.append(hashlib.sha256(data).hexdigest() + '  ' + name)
    upload(name, data)
upload('SHA256SUMS.txt', ('\n'.join(checksums) + '\n').encode())
release = request(base + '/releases/' + str(release['id']), 'PATCH', json.dumps({'draft': False}).encode())
print('Published: ' + release['html_url'], flush=True)
