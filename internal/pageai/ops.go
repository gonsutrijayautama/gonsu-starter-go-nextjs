package pageai

import (
	"bytes"
	"encoding/json"
	"strings"
)

// Event adalah satu kejadian yang dialirkan ke layar (web/lib/page-ai.ts).
// Bagian halaman ditunjuk dengan rujukan pendek dari permintaan ("s1", "s2"),
// bukan urutannya: urutan bergeser begitu satu bagian disisipkan atau dibuang.
type Event struct {
	// Type: "clear", "insert", "update", "remove", "text", "error", atau "done".
	Type string `json:"type"`
	// Ref: bagian yang diubah atau dibuang.
	Ref string `json:"ref,omitempty"`
	// Before: bagian baru ditaruh tepat di atas bagian ini; kosong berarti di
	// paling bawah (model menulisnya "end").
	Before string `json:"before,omitempty"`
	// Item: bagian baru, { "type", "props" }. Isinya diperiksa layar, bukan di sini.
	Item json.RawMessage `json:"item,omitempty"`
	// Props: isian yang berubah pada bagian yang ada.
	Props json.RawMessage `json:"props,omitempty"`
	Text  string          `json:"text,omitempty"`
	// Code dan Message: galat di tengah aliran, sesudah status 200 terkirim.
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
}

const (
	// maxObject: satu perintah paling besar adalah satu bagian halaman dengan
	// daftar yang panjang. Lebih dari ini berarti kurung yang tidak pernah
	// ditutup, dan penampungnya tidak boleh tumbuh terus.
	maxObject = 256 << 10
	maxSay    = 2000
	maxType   = 64
)

// objects memotong teks jawaban model menjadi objek JSON tingkat atas, selagi
// teksnya masih mengalir. Yang di luar objek dibuang: model sering membungkus
// jawabannya dengan pagar kode atau kalimat pembuka walau sudah dilarang, dan
// kadang menulis satu objek dalam beberapa baris.
type objects struct {
	buf      []byte
	depth    int
	inString bool
	escaped  bool
}

func (o *objects) feed(chunk string) [][]byte {
	var out [][]byte
	// Per byte aman untuk UTF-8: kurung, kutip, dan garis miring terbalik
	// tidak pernah muncul di tengah karakter berbyte banyak.
	for i := 0; i < len(chunk); i++ {
		c := chunk[i]
		if o.depth == 0 {
			if c == '{' {
				o.depth = 1
				o.buf = append(o.buf[:0], c)
			}
			continue
		}
		o.buf = append(o.buf, c)
		switch {
		case o.escaped:
			o.escaped = false
		case o.inString:
			switch c {
			case '\\':
				o.escaped = true
			case '"':
				o.inString = false
			}
		case c == '"':
			o.inString = true
		case c == '{':
			o.depth++
		case c == '}':
			o.depth--
			if o.depth == 0 {
				out = append(out, bytes.Clone(o.buf))
				o.buf = o.buf[:0]
			}
		}
		if len(o.buf) > maxObject {
			*o = objects{buf: o.buf[:0]}
		}
	}
	return out
}

// rest adalah objek yang belum ditutup saat alirannya berakhir.
func (o *objects) rest() string {
	if o.depth == 0 {
		return ""
	}
	return string(o.buf)
}

// command adalah satu objek dari model. Selain perintah, dua bentuk lain yang
// lazim ditulis model ikut diterima: satu blok langsung ({ "type", "props" })
// dan seluruh halaman ({ "content": [ … ] }).
type command struct {
	Op      string            `json:"op"`
	Ref     string            `json:"ref"`
	Before  string            `json:"before"`
	Item    json.RawMessage   `json:"item"`
	Props   json.RawMessage   `json:"props"`
	Text    string            `json:"text"`
	Type    string            `json:"type"`
	Content []json.RawMessage `json:"content"`
}

func isObject(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	return len(trimmed) > 0 && trimmed[0] == '{'
}

// validItem: bagian baru harus menyebut jenis bloknya. Jenis yang tidak
// dikenal dan isian yang salah ditolak layar, yang memegang katalog bloknya.
func validItem(raw json.RawMessage) bool {
	if !isObject(raw) {
		return false
	}
	var item struct {
		Type string `json:"type"`
	}
	return json.Unmarshal(raw, &item) == nil && item.Type != "" && len(item.Type) <= maxType
}

// commands memisahkan perintah yang ditulis model menyatu dalam satu objek,
// {"op":"insert",…,"op":"say",…}: setiap "op" memulai perintah baru. Tanpa
// ini encoding/json hanya mengambil "op" yang terakhir, dan perintah
// sebelumnya hilang tanpa jejak — pada uji 2026-10-04 model menjawab "sudah
// ditambahkan" sementara sisipannya tidak pernah sampai ke layar.
func commands(raw []byte) [][]byte {
	dec := json.NewDecoder(bytes.NewReader(raw))
	if open, err := dec.Token(); err != nil || open != json.Delim('{') {
		return nil
	}
	var (
		parts   [][]byte
		current bytes.Buffer
		hasOp   bool
	)
	flush := func() {
		parts = append(parts, append(bytes.Clone(current.Bytes()), '}'))
		current.Reset()
	}
	for dec.More() {
		token, err := dec.Token()
		key, ok := token.(string)
		if err != nil || !ok {
			return nil
		}
		var value json.RawMessage
		if dec.Decode(&value) != nil {
			return nil
		}
		if key == "op" {
			if hasOp {
				flush()
			}
			hasOp = true
		}
		if current.Len() == 0 {
			current.WriteByte('{')
		} else {
			current.WriteByte(',')
		}
		name, _ := json.Marshal(key)
		current.Write(name)
		current.WriteByte(':')
		current.Write(value)
	}
	if len(parts) == 0 {
		return [][]byte{raw}
	}
	flush()
	return parts
}

// translate mengubah satu objek dari model menjadi kejadian untuk layar.
// Kosong berarti objeknya tidak bisa dipakai dan dilewati: jawaban model
// tidak pernah diteruskan tanpa diperiksa bentuknya. refs adalah bagian yang
// ada di halaman saat permintaan dikirim.
func translate(raw []byte, refs map[string]bool) []Event {
	var out []Event
	for _, part := range commands(raw) {
		out = append(out, translateOne(part, refs)...)
	}
	return out
}

func translateOne(raw []byte, refs map[string]bool) []Event {
	var c command
	if json.Unmarshal(raw, &c) != nil {
		return nil
	}
	op := c.Op
	if op == "" {
		switch c.Type {
		// "type" tertulis di tempat "op". Jenis blok selalu berhuruf besar di
		// depan, jadi tidak tertukar dengan nama perintah.
		case "clear", "insert", "update", "remove", "say":
			op, c.Type = c.Type, ""
		}
	}
	switch op {
	case "clear":
		return []Event{{Type: "clear"}}
	case "remove":
		if !refs[c.Ref] {
			return nil
		}
		return []Event{{Type: "remove", Ref: c.Ref}}
	case "update":
		if !refs[c.Ref] || !isObject(c.Props) {
			return nil
		}
		return []Event{{Type: "update", Ref: c.Ref, Props: c.Props}}
	case "insert":
		item := c.Item
		if len(item) == 0 && c.Type != "" {
			// Blok ditulis sejajar dengan perintahnya, tanpa "item".
			item, _ = json.Marshal(map[string]any{"type": c.Type, "props": c.Props})
		}
		if !validItem(item) {
			return nil
		}
		before := c.Before
		if !refs[before] {
			// "end", atau rujukan yang tidak ada: bagiannya tetap dipakai, di paling bawah.
			before = ""
		}
		return []Event{{Type: "insert", Before: before, Item: item}}
	case "say":
		text := strings.TrimSpace(c.Text)
		if text == "" {
			return nil
		}
		if runes := []rune(text); len(runes) > maxSay {
			text = string(runes[:maxSay])
		}
		return []Event{{Type: "text", Text: text}}
	case "":
		if c.Type != "" && validItem(raw) {
			return []Event{{Type: "insert", Item: raw}}
		}
		var out []Event
		for _, item := range c.Content {
			if validItem(item) {
				out = append(out, Event{Type: "insert", Item: item})
			}
		}
		return out
	}
	return nil
}
