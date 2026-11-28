import re

with open("multi_servers.js", "r", encoding="utf-8") as f:
    ms = f.read()

# Replace !imagine block cleanly using regex
imagine_pat = re.compile(
    r"// 2\. !imagine[\s\S]*?// 3\. !edit",
    re.MULTILINE
)

new_imagine = """// 2. !imagine <prompt> -> Free Keyless Flux Text-to-Image (Renders real chat image!)
        else if (/^!imagine\\s+/i.test(trimmed)) {
            const prompt = trimmed.replace(/^!imagine\\s+/i, '').trim();
            if (!prompt) return;
            if (!isSafePrompt(prompt)) return socket.emit('message', { username: '🛡️ Safety Shield', text: `@${uname}: ⚠️ Unsafe image prompt blocked!`, _serverId: room });

            socket.emit('message', { username: '🎨 SammuArt AI', text: `@${uname}: 🎨 Painting "${prompt}"... (5s)`, _serverId: room });
            try {
                const seed = Math.floor(Math.random() * 999999);
                const fullUrl = "https://pollinations.ai" + encodeURIComponent(prompt) + "?width=420&height=420&seed=" + seed + "&nologo=true";
                const imgRes = await fetch(fullUrl);
                const buf = Buffer.from(await imgRes.arrayBuffer());
                const dataUrl = "data:image/jpeg;base64," + buf.toString("base64");

                io.to(room).emit('message', { username: '🎨 SammuArt AI', text: `@${uname} generated: **${prompt}**`, _serverId: room });
                io.to(room).emit('chatImage', { username: '🎨 SammuArt AI', image: dataUrl, img: dataUrl, _serverId: room });
            } catch (err) {
                socket.emit('message', { username: '🎨 SammuArt AI', text: `@${uname}: ⚠️ Art generator busy, try again!`, _serverId: room });
            }
        }

        // 3. !edit"""

# Replace !edit block cleanly up to the closing braces before `return OG_HOSTS;`
edit_pat = re.compile(
    r"// 3\. !edit[\s\S]*?(?=\s*return OG_HOSTS;)",
    re.MULTILINE
)

new_edit = """// 3. !edit <dress/style prompt> -> Image-to-Image Outfit & Style Transformer
        else if (/^!edit\\s+/i.test(trimmed)) {
            const editPrompt = trimmed.replace(/^!edit\\s+/i, '').trim();
            if (!isSafePrompt(editPrompt)) return socket.emit('message', { username: '🛡️ Safety Shield', text: `@${uname}: ⚠️ Unsafe outfit/image edit blocked!`, _serverId: room });

            const imgId = lastUserImage.get(uname.toLowerCase()) || lastUserImage.get('__latest_room__');
            if (!imgId || !tempEditImages.has(imgId)) {
                socket.emit('message', {
                    username: '👗 SammuStyle AI',
                    text: `@${uname}: 📸 Pehle chat mein ek **photo upload** karo, phir likho \\`!edit ${editPrompt || 'change dress to royal black jacket'}\\`!`,
                    _serverId: room
                });
                return;
            }
            socket.emit('message', { username: '👗 SammuStyle AI', text: `@${uname}: ✨ Transforming outfit/style... (8s)`, _serverId: room });
            try {
                const host = socket.handshake.headers.host;
                const proto = host && host.includes('ngrok') ? 'https' : 'http';
                const srcUrl = `${proto}://${host}/ai-temp-img/${imgId}`;
                const seed = Math.floor(Math.random() * 999999);
                const editedUrl = "https://pollinations.ai" + encodeURIComponent(editPrompt) + "?model=kontext&image=" + encodeURIComponent(srcUrl) + "&width=420&height=420&seed=" + seed + "&nologo=true";
                const imgRes = await fetch(editedUrl);
                const buf = Buffer.from(await imgRes.arrayBuffer());
                const dataUrl = "data:image/jpeg;base64," + buf.toString("base64");

                io.to(room).emit('message', { username: '👗 SammuStyle AI', text: `@${uname} styled: **${editPrompt}**`, _serverId: room });
                io.to(room).emit('chatImage', { username: '👗 SammuStyle AI', image: dataUrl, img: dataUrl, _serverId: room });
            } catch (err) {
                socket.emit('message', { username: '👗 SammuStyle AI', text: `@${uname}: ⚠️ Style studio busy, try again!`, _serverId: room });
            }
        }
    });
});
"""

ms, c1 = imagine_pat.subn(new_imagine, ms, count=1)
ms, c2 = edit_pat.subn(new_edit, ms, count=1)
print(f"Replaced !imagine ({c1}) and !edit ({c2})")

with open("multi_servers.js", "w", encoding="utf-8") as f:
    f.write(ms)
