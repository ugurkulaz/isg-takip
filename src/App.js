import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabase";

// ─── SABITLER ────────────────────────────────────────────────────────────────
const TEHLIKE = {
  "Az Tehlikeli":  { renk: "#4ade80", bg: "#052e16", sure: 36, icon: "🟢" },
  "Tehlikeli":     { renk: "#fbbf24", bg: "#1c1403", sure: 24, icon: "🟡" },
  "Çok Tehlikeli": { renk: "#f87171", bg: "#1f0707", sure: 12, icon: "🔴" },
};
const EGITIM_TURLERI = [
  { id: "isg",     ad: "İSG Temel Eğitimi",  icon: "🛡️", periyotFn: (t) => TEHLIKE[t]?.sure || 24 },
  { id: "yangin",  ad: "Yangın Güvenliği",   icon: "🔥", periyotFn: () => 12 },
  { id: "ilkyard", ad: "İlk Yardım",         icon: "🏥", periyotFn: () => 36 },
  { id: "kkd",     ad: "KKD Kullanımı",      icon: "⛑️", periyotFn: () => 24 },
];
const MUAYENE_TURLERI = [
  { id: "periyodik", ad: "Periyodik Sağlık Muayenesi", icon: "🩺", periyotFn: (t) => TEHLIKE[t]?.sure || 24 },
  { id: "ise_giris", ad: "İşe Giriş Muayenesi",        icon: "📋", periyotFn: () => null },
];
const SERTIFIKA_TURLERI = [
  { id: "forklift", ad: "Forklift Operatörü",    icon: "🚜", periyot: 60 },
  { id: "vinc",     ad: "Vinç Operatörü",         icon: "🏗️", periyot: 60 },
  { id: "elektrik", ad: "Elektrik Yetki Belgesi", icon: "⚡", periyot: 60 },
  { id: "kaynak",   ad: "Kaynak Sertifikası",     icon: "🔧", periyot: 36 },
];

// ─── YARDIMCI ────────────────────────────────────────────────────────────────
const bugun = () => new Date().toISOString().split("T")[0];
const formatTarih = (t) => t ? new Date(t).toLocaleDateString("tr-TR") : "—";
const gunFarki = (tarih) => Math.ceil((new Date(tarih) - new Date()) / 86400000);
const sonrakiTarih = (baslangic, ayEkle) => {
  if (!baslangic || !ayEkle) return null;
  const d = new Date(baslangic);
  d.setMonth(d.getMonth() + ayEkle);
  return d.toISOString().split("T")[0];
};
const durumHesapla = (sonTarih, periyot) => {
  if (!sonTarih || !periyot) return { label: "Kayıt Yok", renk: "#64748b", bg: "#1e293b", onc: 0 };
  const sonraki = sonrakiTarih(sonTarih, periyot);
  const gun = gunFarki(sonraki);
  if (gun < 0)   return { label: "Süresi Dolmuş", renk: "#f87171", bg: "#1f0707", onc: 4 };
  if (gun <= 30)  return { label: "Kritik",         renk: "#fb923c", bg: "#1c0a03", onc: 3 };
  if (gun <= 90)  return { label: "Yaklaşıyor",     renk: "#fbbf24", bg: "#1c1403", onc: 2 };
  return               { label: "Güncel",           renk: "#4ade80", bg: "#052e16", onc: 1 };
};

// ─── UI BİLEŞENLERİ ──────────────────────────────────────────────────────────
const Badge = ({ d, tarih }) => (
  <div style={{ textAlign: "center", minWidth: 90 }}>
    <span style={{ background: d.bg, color: d.renk, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, display: "inline-block" }}>{d.label}</span>
    {tarih && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{formatTarih(tarih)}</div>}
  </div>
);
const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false, type = "button" }) => (
  <button type={type} onClick={onClick} disabled={disabled} style={{
    padding: "8px 16px", borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13, fontWeight: 600, opacity: disabled ? 0.5 : 1,
    background: variant === "primary" ? "#2563eb" : variant === "danger" ? "#dc2626" : variant === "success" ? "#16a34a" : "#1f2937",
    color: "#fff", ...style
  }}>{children}</button>
);
const Card = ({ children, style = {} }) => (
  <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 14, overflow: "hidden", ...style }}>{children}</div>
);
const CardHeader = ({ title, right }) => (
  <div style={{ padding: "14px 20px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <span style={{ fontWeight: 700, color: "#f9fafb", fontSize: 15 }}>{title}</span>
    {right}
  </div>
);
const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 13, color: "#9ca3af", marginBottom: 5 }}>{label}</label>}
    <input {...props} style={{ width: "100%", padding: "10px 14px", background: "#0f172a", border: "1px solid #374151", borderRadius: 8, color: "#e5e7eb", fontSize: 14, boxSizing: "border-box" }} />
  </div>
);
const Select = ({ label, children, ...props }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 13, color: "#9ca3af", marginBottom: 5 }}>{label}</label>}
    <select {...props} style={{ width: "100%", padding: "10px 14px", background: "#0f172a", border: "1px solid #374151", borderRadius: 8, color: "#e5e7eb", fontSize: 14 }}>{children}</select>
  </div>
);
const Modal = ({ children, onClose, title, width = 500 }) => (
  <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 16, width, maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontWeight: 800, fontSize: 18, color: "#f9fafb" }}>{title}</span>
        <button onClick={onClose} style={{ background: "#1f2937", border: "none", color: "#9ca3af", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

// ─── GİRİŞ EKRANI ────────────────────────────────────────────────────────────
const GirisEkrani = ({ onGiris }) => {
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  const girisYap = async (e) => {
    e.preventDefault();
    setYukleniyor(true);
    setHata("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: sifre });
    if (error) {
      setHata("E-posta veya şifre hatalı!");
      setYukleniyor(false);
    } else {
      onGiris();
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ width: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>🛡️</div>
          <div style={{ fontWeight: 800, fontSize: 24, color: "#f9fafb" }}>İSG Takip Sistemi</div>
          <div style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>İş Sağlığı & Güvenliği Yönetimi</div>
        </div>

        {/* Form */}
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#f9fafb", marginBottom: 24 }}>Giriş Yap</div>

          <form onSubmit={girisYap}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>E-posta</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@sirket.com" required
                style={{ width: "100%", padding: "12px 14px", background: "#0f172a", border: "1px solid #374151", borderRadius: 8, color: "#e5e7eb", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>Şifre</label>
              <input type="password" value={sifre} onChange={e => setSifre(e.target.value)} placeholder="••••••••" required
                style={{ width: "100%", padding: "12px 14px", background: "#0f172a", border: "1px solid #374151", borderRadius: 8, color: "#e5e7eb", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            {hata && (
              <div style={{ background: "#1f0707", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13, marginBottom: 16 }}>
                ⚠️ {hata}
              </div>
            )}

            <button type="submit" disabled={yukleniyor} style={{
              width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: yukleniyor ? "not-allowed" : "pointer",
              background: "#2563eb", color: "#fff", fontSize: 15, fontWeight: 700, opacity: yukleniyor ? 0.7 : 1
            }}>
              {yukleniyor ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#374151" }}>
          © 2025 İSG Takip Sistemi · Güvenli Bağlantı 🔒
        </div>
      </div>
    </div>
  );
};

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────
export default function App() {
  const [oturum, setOturum] = useState(null);
  const [oturumYukleniyor, setOturumYukleniyor] = useState(true);
  const [sayfa, setSayfa] = useState("dashboard");
  const [firmalar, setFirmalar] = useState([]);
  const [personel, setPersonel] = useState([]);
  const [egitimler, setEgitimler] = useState([]);
  const [muayeneler, setMuayeneler] = useState([]);
  const [sertifikalar, setSertifikalar] = useState([]);
  const [dokumanlar, setDokumanlar] = useState([]);
  const [secFirmaDetay, setSecFirmaDetay] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secFirma, setSecFirma] = useState(null);
  const [secPersonel, setSecPersonel] = useState(null);
  const [modal, setModal] = useState(null);
  const [aramaP, setAramaP] = useState("");
  const [bildirimler, setBildirimler] = useState([]);
  const [importMetin, setImportMetin] = useState("");
  const [karsilastirSonuc, setKarsilastirSonuc] = useState(null);
  const [aktifTab, setAktifTab] = useState("egitim");
  const dosyaRef = useRef();

  // ─── OTURUM KONTROLÜ ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setOturum(session);
      setOturumYukleniyor(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setOturum(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (oturum) veriYukle();
  }, [oturum]);

  const cikisYap = async () => {
    await supabase.auth.signOut();
    setOturum(null);
    setFirmalar([]);
    setPersonel([]);
  };

  // ─── VERİ YÜKLEME ──────────────────────────────────────────────────────────
  const veriYukle = async () => {
    setYukleniyor(true);
    const [f, p, e, m, s, d] = await Promise.all([
      supabase.from("firmalar").select("*").order("ad"),
      supabase.from("personel").select("*").order("ad_soyad"),
      supabase.from("egitimler").select("*"),
      supabase.from("muayeneler").select("*"),
      supabase.from("sertifikalar").select("*"),
      supabase.from("dokumanlar").select("*"),
    ]);
    if (f.data) setFirmalar(f.data);
    if (p.data) setPersonel(p.data);
    if (e.data) setEgitimler(e.data);
    if (m.data) setMuayeneler(m.data);
    if (s.data) setSertifikalar(s.data);
    if (d.data) setDokumanlar(d.data);
    setYukleniyor(false);
  };

  // ─── HESAPLAMALAR ──────────────────────────────────────────────────────────
  const aktifPersonel = useMemo(() => personel.filter(p => p.aktif), [personel]);

  const sonEgitimBul = (personelId, tur) => {
    const kayitlar = egitimler.filter(e => e.personel_id === personelId && e.egitim_turu === tur);
    if (!kayitlar.length) return null;
    return kayitlar.sort((a, b) => new Date(b.egitim_tarihi) - new Date(a.egitim_tarihi))[0].egitim_tarihi;
  };
  const sonMuayeneBul = (personelId, tur) => {
    const kayitlar = muayeneler.filter(m => m.personel_id === personelId && m.muayene_turu === tur);
    if (!kayitlar.length) return null;
    return kayitlar.sort((a, b) => new Date(b.muayene_tarihi) - new Date(a.muayene_tarihi))[0].muayene_tarihi;
  };
  const sonSertifikaBul = (personelId, tur) => {
    const kayitlar = sertifikalar.filter(s => s.personel_id === personelId && s.sertifika_turu === tur);
    if (!kayitlar.length) return null;
    return kayitlar.sort((a, b) => new Date(b.verilis_tarihi) - new Date(a.verilis_tarihi))[0].verilis_tarihi;
  };

  const firmaIstatistik = useMemo(() => firmalar.map(f => {
    const fps = aktifPersonel.filter(p => p.firma_id === f.id);
    let kritikSay = 0;
    fps.forEach(p => {
      EGITIM_TURLERI.forEach(e => {
        const d = durumHesapla(sonEgitimBul(p.id, e.id), e.periyotFn(f.tehlike_sinifi));
        if (d.onc >= 3) kritikSay++;
      });
    });
    return { ...f, t: TEHLIKE[f.tehlike_sinifi] || TEHLIKE["Tehlikeli"], personelSay: fps.length, kritikSay };
  }), [firmalar, aktifPersonel, egitimler]);

  const genelIstat = useMemo(() => {
    let kritik = 0, yaklasan = 0, guncel = 0;
    aktifPersonel.forEach(p => {
      const f = firmalar.find(x => x.id === p.firma_id);
      if (!f) return;
      EGITIM_TURLERI.forEach(e => {
        const d = durumHesapla(sonEgitimBul(p.id, e.id), e.periyotFn(f.tehlike_sinifi));
        if (d.onc >= 3) kritik++;
        else if (d.onc === 2) yaklasan++;
        else if (d.onc === 1) guncel++;
      });
    });
    return { toplam: aktifPersonel.length, firmaSay: firmalar.length, kritik, yaklasan, guncel };
  }, [aktifPersonel, firmalar, egitimler]);

  // ─── CRUD ──────────────────────────────────────────────────────────────────
  const firmaEkle = async (data) => {
    const { error } = await supabase.from("firmalar").insert(data);
    if (!error) { await veriYukle(); setModal(null); }
    else alert("Hata: " + error.message);
  };
  const firmaSil = async (id) => {
    if (!window.confirm("Bu firmayı silmek istediğinize emin misiniz?")) return;
    await supabase.from("firmalar").delete().eq("id", id);
    await veriYukle();
  };
  const firmaGuncelle = async (id, data) => {
    await supabase.from("firmalar").update(data).eq("id", id);
    await veriYukle();
  };
  const dokumanKaydet = async (firmaId, kategori, baslik, durum, tarih, notlar) => {
    const { error } = await supabase.from("dokumanlar").insert({ firma_id: firmaId, kategori, baslik, durum, tarih: tarih || null, notlar });
    if (error) alert("Hata: " + error.message);
    else await veriYukle();
  };
  const dokumanGuncelle = async (id, data) => {
    await supabase.from("dokumanlar").update(data).eq("id", id);
    await veriYukle();
  };
  const dokumanSil = async (id) => {
    if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    await supabase.from("dokumanlar").delete().eq("id", id);
    await veriYukle();
  };
  const egitimKaydet = async (personelId, tur, tarih) => {
    const { error } = await supabase.from("egitimler").insert({ personel_id: personelId, egitim_turu: tur, egitim_tarihi: tarih });
    if (error) { alert("Hata: " + error.message); return; }
    await veriYukle();
  };
  const muayeneKaydet = async (personelId, tur, tarih) => {
    const { error } = await supabase.from("muayeneler").insert({ personel_id: personelId, muayene_turu: tur, muayene_tarihi: tarih });
    if (error) { alert("Hata: " + error.message); return; }
    await veriYukle();
  };
  const sertifikaKaydet = async (personelId, tur, tarih) => {
    const { error } = await supabase.from("sertifikalar").insert({ personel_id: personelId, sertifika_turu: tur, verilis_tarihi: tarih });
    if (error) { alert("Hata: " + error.message); return; }
    await veriYukle();
  };

  // ─── PERSONEL KARŞILAŞTIRMA ────────────────────────────────────────────────
  const karsilastir = () => {
    if (!secFirma || !importMetin.trim()) return;
    const satirlar = importMetin.trim().split("\n").map(s => s.trim()).filter(Boolean);
    const yeniListe = satirlar.map(s => {
      const p = s.split(/[\t,;]/);
      const tc = p[0]?.trim();
      const ad = p[1]?.trim() || "Bilinmiyor";
      const gorev = p[2]?.trim() || "";
      // İşe giriş tarihi: 4. sütun, DD.MM.YYYY veya YYYY-MM-DD formatını destekle
      let iseGiris = p[3]?.trim() || null;
      if (iseGiris) {
        // DD.MM.YYYY → YYYY-MM-DD dönüşümü
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(iseGiris)) {
          const [gun, ay, yil] = iseGiris.split(".");
          iseGiris = `${yil}-${ay}-${gun}`;
        }
        // Geçersiz tarihse null yap
        if (isNaN(new Date(iseGiris).getTime())) iseGiris = null;
      }
      return { tc, ad, gorev, iseGiris };
    }).filter(x => x.tc && x.tc.length >= 10);
    const mevcutlar = aktifPersonel.filter(p => p.firma_id === secFirma.id);
    const yeniTCSet = new Set(yeniListe.map(x => x.tc));
    const cikmis = mevcutlar.filter(p => !yeniTCSet.has(p.tc_no));
    const mevcutTCSet = new Set(mevcutlar.map(p => p.tc_no));
    const gelen = yeniListe.filter(x => !mevcutTCSet.has(x.tc));
    setKarsilastirSonuc({ cikmis, gelen });
  };

  const karsilastirUygula = async () => {
    if (!karsilastirSonuc) return;
    const { cikmis, gelen } = karsilastirSonuc;
    for (const p of cikmis) await supabase.from("personel").update({ aktif: false, cikis_tarihi: bugun() }).eq("id", p.id);
    for (const g of gelen) await supabase.from("personel").insert({
      firma_id: secFirma.id,
      tc_no: g.tc,
      ad_soyad: g.ad,
      gorev: g.gorev,
      ise_giris: g.iseGiris || bugun(),
      aktif: true
    });
    // Mevcut personelin işe giriş tarihini ve görevini güncelle
    const mevcutlar2 = aktifPersonel.filter(p => p.firma_id === secFirma.id);
    const satirlar2 = importMetin.trim().split("\n").map(s => s.trim()).filter(Boolean);
    const yeniMap = {};
    satirlar2.forEach(s => {
      const p = s.split(/[\t,;]/);
      const tc = p[0]?.trim();
      const gorev = p[2]?.trim() || "";
      let iseGiris = p[3]?.trim() || null;
      if (iseGiris && /^\d{2}\.\d{2}\.\d{4}$/.test(iseGiris)) {
        const [gun, ay, yil] = iseGiris.split(".");
        iseGiris = `${yil}-${ay}-${gun}`;
      }
      if (tc) yeniMap[tc] = { gorev, iseGiris };
    });
    for (const p of mevcutlar2) {
      const yeni = yeniMap[p.tc_no];
      if (yeni?.iseGiris && yeni.iseGiris !== p.ise_giris) {
        await supabase.from("personel").update({ ise_giris: yeni.iseGiris, gorev: yeni.gorev || p.gorev }).eq("id", p.id);
      }
    }
    const mesajlar = [];
    if (cikmis.length) mesajlar.push({ tip: "cikis", mesaj: `${cikmis.length} personel pasife alındı` });
    if (gelen.length) mesajlar.push({ tip: "giris", mesaj: `${gelen.length} yeni personel eklendi — eğitim planlanmalı!` });
    setBildirimler(b => [...b, ...mesajlar]);
    setKarsilastirSonuc(null);
    setImportMetin("");
    setModal(null);
    await veriYukle();
  };

  // ─── MODALLER ──────────────────────────────────────────────────────────────
  const FirmaEkleModal = () => {
    const [form, setForm] = useState({ ad: "", tehlike_sinifi: "Tehlikeli", sektor: "" });
    return (
      <Modal title="🏭 Yeni Firma Ekle" onClose={() => setModal(null)}>
        <Input label="Firma Adı" value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} placeholder="Firma adı" />
        <Input label="Sektör" value={form.sektor} onChange={e => setForm(f => ({ ...f, sektor: e.target.value }))} placeholder="Sektör" />
        <Select label="Tehlike Sınıfı" value={form.tehlike_sinifi} onChange={e => setForm(f => ({ ...f, tehlike_sinifi: e.target.value }))}>
          {Object.keys(TEHLIKE).map(k => <option key={k}>{k}</option>)}
        </Select>
        <div style={{ padding: "12px 16px", background: "#0f172a", borderRadius: 8, fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          {TEHLIKE[form.tehlike_sinifi]?.icon} Eğitim periyodu: Her <strong style={{ color: "#60a5fa" }}>{TEHLIKE[form.tehlike_sinifi]?.sure} ayda</strong> bir
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => setModal(null)} variant="secondary" style={{ flex: 1 }}>İptal</Btn>
          <Btn onClick={() => form.ad && firmaEkle(form)} style={{ flex: 1 }}>Firma Ekle</Btn>
        </div>
      </Modal>
    );
  };

  const FirmaGuncelleModal = ({ firma }) => {
    const [form, setForm] = useState({
      ad: firma.ad || "",
      tehlike_sinifi: firma.tehlike_sinifi || "Tehlikeli",
      sektor: firma.sektor || "",
      calisansayisi: firma.calisansayisi || "",
      sorumlu_kisi: firma.sorumlu_kisi || "",
      iletisim: firma.iletisim || "",
    });
    return (
      <Modal title={`✏️ ${firma.ad} — Firma Güncelle`} onClose={() => setSecFirmaDetay(null)}>
        <Input label="Firma Adı" value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} />
        <Input label="Sektör" value={form.sektor} onChange={e => setForm(f => ({ ...f, sektor: e.target.value }))} />
        <Select label="Tehlike Sınıfı" value={form.tehlike_sinifi} onChange={e => setForm(f => ({ ...f, tehlike_sinifi: e.target.value }))}>
          {Object.keys(TEHLIKE).map(k => <option key={k}>{k}</option>)}
        </Select>
        <Input label="Çalışan Sayısı" type="number" value={form.calisansayisi} onChange={e => setForm(f => ({ ...f, calisansayisi: e.target.value }))} />
        <Input label="Sorumlu Kişi" value={form.sorumlu_kisi} onChange={e => setForm(f => ({ ...f, sorumlu_kisi: e.target.value }))} placeholder="İSG sorumlusu adı" />
        <Input label="İletişim" value={form.iletisim} onChange={e => setForm(f => ({ ...f, iletisim: e.target.value }))} placeholder="Telefon veya e-posta" />
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => setSecFirmaDetay(null)} variant="secondary" style={{ flex: 1 }}>İptal</Btn>
          <Btn onClick={async () => { await firmaGuncelle(firma.id, form); setSecFirmaDetay(null); }} style={{ flex: 1 }}>Kaydet</Btn>
        </div>
      </Modal>
    );
  };


    <Modal title="📥 Aylık Personel Listesi Güncelle" onClose={() => { setModal(null); setKarsilastirSonuc(null); setImportMetin(""); }} width={580}>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Yeni listeyi yükleyin. Çıkanlar pasife alınır, yeniler eklenir.</div>
      <Select label="Firma" value={secFirma?.id || ""} onChange={e => setSecFirma(firmalar.find(f => f.id === Number(e.target.value)))}>
        <option value="">-- Firma Seçin --</option>
        {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
      </Select>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>CSV Dosyası <span style={{ color: "#6b7280" }}>(TC No, Ad Soyad, Görev)</span></label>
        <input ref={dosyaRef} type="file" accept=".csv,.txt" onChange={e => {
          const file = e.target.files[0];
          if (file) { const r = new FileReader(); r.onload = ev => setImportMetin(ev.target.result); r.readAsText(file, "UTF-8"); }
        }} style={{ display: "none" }} />
        <Btn onClick={() => dosyaRef.current.click()} variant="secondary">📁 Dosya Seç</Btn>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>veya yapıştırın</label>
        <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Format: <span style={{ color: "#60a5fa", fontFamily: "monospace" }}>TC No · Ad Soyad · Görev · İşe Giriş Tarihi</span> (Tab veya virgülle ayrılmış)</div>
        <textarea value={importMetin} onChange={e => setImportMetin(e.target.value)} rows={6}
          placeholder={"TC No\tAd Soyad\tGörev\tİşe Giriş\n12345678901\tAhmet Yılmaz\tOperatör\t15.06.2023\n98765432101\tAyşe Kaya\tMühendis\t01.03.2024"}
          style={{ width: "100%", padding: "10px 14px", background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#e5e7eb", fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "monospace" }} />
      </div>
      {karsilastirSonuc && (
        <div style={{ background: "#111827", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>📊 Karşılaştırma Sonucu</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ background: "#1f0707", borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#f87171", fontWeight: 700, marginBottom: 6 }}>🚪 Çıkan ({karsilastirSonuc.cikmis.length})</div>
              {karsilastirSonuc.cikmis.map(c => <div key={c.id} style={{ fontSize: 12, color: "#fca5a5" }}>{c.ad_soyad}</div>)}
              {!karsilastirSonuc.cikmis.length && <div style={{ fontSize: 12, color: "#6b7280" }}>Çıkan yok</div>}
            </div>
            <div style={{ background: "#052e16", borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#4ade80", fontWeight: 700, marginBottom: 6 }}>🆕 Yeni ({karsilastirSonuc.gelen.length})</div>
              {karsilastirSonuc.gelen.map((g, i) => <div key={i} style={{ fontSize: 12, color: "#86efac" }}>{g.ad}</div>)}
              {!karsilastirSonuc.gelen.length && <div style={{ fontSize: 12, color: "#6b7280" }}>Yeni yok</div>}
            </div>
          </div>
          <Btn onClick={karsilastirUygula} variant="success" style={{ width: "100%" }}>✅ Değişiklikleri Uygula</Btn>
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={() => { setModal(null); setKarsilastirSonuc(null); setImportMetin(""); }} variant="secondary" style={{ flex: 1 }}>İptal</Btn>
        {!karsilastirSonuc && <Btn onClick={karsilastir} style={{ flex: 1 }} disabled={!secFirma || !importMetin.trim()}>🔍 Karşılaştır</Btn>}
      </div>
    </Modal>
  );

  const PersonelDetay = ({ p }) => {
    const firma = firmalar.find(f => f.id === p.firma_id);
    const [tarihler, setTarihler] = useState({});
    const [gecmisAc, setGecmisAc] = useState({});

    const egitimSil = async (id) => {
      if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
      await supabase.from("egitimler").delete().eq("id", id);
      await veriYukle();
    };
    const muayeneSil = async (id) => {
      if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
      await supabase.from("muayeneler").delete().eq("id", id);
      await veriYukle();
    };
    const sertifikaSil = async (id) => {
      if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
      await supabase.from("sertifikalar").delete().eq("id", id);
      await veriYukle();
    };
    return (
      <Modal title={p.ad_soyad} onClose={() => setSecPersonel(null)} width={640}>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          {p.gorev} · {firma?.ad} · TC: {p.tc_no} · İşe Giriş: {formatTarih(p.ise_giris)}
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#1f2937", borderRadius: 10, padding: 4 }}>
          {[["egitim","🛡️ Eğitimler"],["muayene","🩺 Muayeneler"],["sertifika","📜 Sertifikalar"]].map(([id, label]) => (
            <button key={id} onClick={() => setAktifTab(id)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: aktifTab === id ? "#2563eb" : "transparent", color: aktifTab === id ? "#fff" : "#6b7280" }}>{label}</button>
          ))}
        </div>
        {aktifTab === "egitim" && EGITIM_TURLERI.map(e => {
          const periyot = e.periyotFn(firma?.tehlike_sinifi);
          const tumKayitlar = egitimler.filter(x => x.personel_id === p.id && x.egitim_turu === e.id).sort((a,b) => new Date(b.egitim_tarihi) - new Date(a.egitim_tarihi));
          const son = tumKayitlar[0]?.egitim_tarihi || null;
          const d = durumHesapla(son, periyot);
          return (
            <div key={e.id} style={{ background: "#111827", borderRadius: 10, padding: 14, marginBottom: 10, border: "1px solid #1f2937" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{e.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#f3f4f6" }}>{e.ad}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Sonraki: {formatTarih(sonrakiTarih(son, periyot))}</div>
                </div>
                <Badge d={d} tarih={son} />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: tumKayitlar.length > 0 ? 8 : 0 }}>
                <input type="date" value={tarihler[e.id] || ""} onChange={ev => setTarihler(t => ({ ...t, [e.id]: ev.target.value }))}
                  style={{ flex: 1, padding: "7px 12px", background: "#0f172a", border: "1px solid #374151", borderRadius: 7, color: tarihler[e.id] ? "#e5e7eb" : "#6b7280", fontSize: 13 }} />
                <Btn variant="success" style={{ padding: "7px 14px", opacity: tarihler[e.id] ? 1 : 0.4 }} disabled={!tarihler[e.id]} onClick={() => { egitimKaydet(p.id, e.id, tarihler[e.id]); setTarihler(t => ({ ...t, [e.id]: "" })); }}>Kaydet</Btn>
              </div>
              {tumKayitlar.length > 0 && (
                <div>
                  <button onClick={() => setGecmisAc(g => ({ ...g, [e.id]: !g[e.id] }))} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", padding: "2px 0" }}>
                    {gecmisAc[e.id] ? "▲ Geçmişi gizle" : `▼ Geçmiş kayıtlar (${tumKayitlar.length})`}
                  </button>
                  {gecmisAc[e.id] && (
                    <div style={{ marginTop: 8, borderTop: "1px solid #1f2937", paddingTop: 8 }}>
                      {tumKayitlar.map((k, i) => (
                        <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: i < tumKayitlar.length-1 ? "1px solid #1f2937" : "none" }}>
                          <span style={{ fontSize: 13, color: i === 0 ? "#4ade80" : "#9ca3af" }}>{i === 0 ? "✅ " : "  "}{formatTarih(k.egitim_tarihi)}</span>
                          <button onClick={() => egitimSil(k.id)} style={{ background: "#1f0707", border: "1px solid #7f1d1d", color: "#f87171", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>Sil</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {aktifTab === "muayene" && MUAYENE_TURLERI.map(m => {
          const periyot = m.periyotFn(firma?.tehlike_sinifi);
          const tumKayitlar = muayeneler.filter(x => x.personel_id === p.id && x.muayene_turu === m.id).sort((a,b) => new Date(b.muayene_tarihi) - new Date(a.muayene_tarihi));
          const son = tumKayitlar[0]?.muayene_tarihi || null;
          const d = durumHesapla(son, periyot);
          return (
            <div key={m.id} style={{ background: "#111827", borderRadius: 10, padding: 14, marginBottom: 10, border: "1px solid #1f2937" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#f3f4f6" }}>{m.ad}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{periyot ? `Sonraki: ${formatTarih(sonrakiTarih(son, periyot))}` : "Tek seferlik"}</div>
                </div>
                {periyot && <Badge d={d} tarih={son} />}
                {!periyot && son && <span style={{ fontSize: 12, color: "#4ade80" }}>✅ {formatTarih(son)}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: tumKayitlar.length > 0 ? 8 : 0 }}>
                <input type="date" value={tarihler[`m_${m.id}`] || ""} onChange={ev => setTarihler(t => ({ ...t, [`m_${m.id}`]: ev.target.value }))}
                  style={{ flex: 1, padding: "7px 12px", background: "#0f172a", border: "1px solid #374151", borderRadius: 7, color: tarihler[`m_${m.id}`] ? "#e5e7eb" : "#6b7280", fontSize: 13 }} />
                <Btn variant="success" style={{ padding: "7px 14px", opacity: tarihler[`m_${m.id}`] ? 1 : 0.4 }} disabled={!tarihler[`m_${m.id}`]} onClick={() => { muayeneKaydet(p.id, m.id, tarihler[`m_${m.id}`]); setTarihler(t => ({ ...t, [`m_${m.id}`]: "" })); }}>Kaydet</Btn>
              </div>
              {tumKayitlar.length > 0 && (
                <div>
                  <button onClick={() => setGecmisAc(g => ({ ...g, [`m_${m.id}`]: !g[`m_${m.id}`] }))} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", padding: "2px 0" }}>
                    {gecmisAc[`m_${m.id}`] ? "▲ Geçmişi gizle" : `▼ Geçmiş kayıtlar (${tumKayitlar.length})`}
                  </button>
                  {gecmisAc[`m_${m.id}`] && (
                    <div style={{ marginTop: 8, borderTop: "1px solid #1f2937", paddingTop: 8 }}>
                      {tumKayitlar.map((k, i) => (
                        <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: i < tumKayitlar.length-1 ? "1px solid #1f2937" : "none" }}>
                          <span style={{ fontSize: 13, color: i === 0 ? "#4ade80" : "#9ca3af" }}>{i === 0 ? "✅ " : "  "}{formatTarih(k.muayene_tarihi)}</span>
                          <button onClick={() => muayeneSil(k.id)} style={{ background: "#1f0707", border: "1px solid #7f1d1d", color: "#f87171", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>Sil</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {aktifTab === "sertifika" && SERTIFIKA_TURLERI.map(s => {
          const tumKayitlar = sertifikalar.filter(x => x.personel_id === p.id && x.sertifika_turu === s.id).sort((a,b) => new Date(b.verilis_tarihi) - new Date(a.verilis_tarihi));
          const son = tumKayitlar[0]?.verilis_tarihi || null;
          const d = durumHesapla(son, s.periyot);
          return (
            <div key={s.id} style={{ background: "#111827", borderRadius: 10, padding: 14, marginBottom: 10, border: "1px solid #1f2937" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#f3f4f6" }}>{s.ad}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Periyot: {s.periyot} ay{son ? ` · Sonraki: ${formatTarih(sonrakiTarih(son, s.periyot))}` : ""}</div>
                </div>
                {son && <Badge d={d} tarih={son} />}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: tumKayitlar.length > 0 ? 8 : 0 }}>
                <input type="date" value={tarihler[`s_${s.id}`] || ""} onChange={ev => setTarihler(t => ({ ...t, [`s_${s.id}`]: ev.target.value }))}
                  style={{ flex: 1, padding: "7px 12px", background: "#0f172a", border: "1px solid #374151", borderRadius: 7, color: tarihler[`s_${s.id}`] ? "#e5e7eb" : "#6b7280", fontSize: 13 }} />
                <Btn variant="success" style={{ padding: "7px 14px", opacity: tarihler[`s_${s.id}`] ? 1 : 0.4 }} disabled={!tarihler[`s_${s.id}`]} onClick={() => { sertifikaKaydet(p.id, s.id, tarihler[`s_${s.id}`]); setTarihler(t => ({ ...t, [`s_${s.id}`]: "" })); }}>Kaydet</Btn>
              </div>
              {tumKayitlar.length > 0 && (
                <div>
                  <button onClick={() => setGecmisAc(g => ({ ...g, [`s_${s.id}`]: !g[`s_${s.id}`] }))} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", padding: "2px 0" }}>
                    {gecmisAc[`s_${s.id}`] ? "▲ Geçmişi gizle" : `▼ Geçmiş kayıtlar (${tumKayitlar.length})`}
                  </button>
                  {gecmisAc[`s_${s.id}`] && (
                    <div style={{ marginTop: 8, borderTop: "1px solid #1f2937", paddingTop: 8 }}>
                      {tumKayitlar.map((k, i) => (
                        <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: i < tumKayitlar.length-1 ? "1px solid #1f2937" : "none" }}>
                          <span style={{ fontSize: 13, color: i === 0 ? "#4ade80" : "#9ca3af" }}>{i === 0 ? "✅ " : "  "}{formatTarih(k.verilis_tarihi)}</span>
                          <button onClick={() => sertifikaSil(k.id)} style={{ background: "#1f0707", border: "1px solid #7f1d1d", color: "#f87171", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>Sil</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Modal>
    );
  };

  // ─── SAYFALAR ──────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <div>
      {bildirimler.map((b, i) => (
        <div key={i} style={{ background: b.tip === "cikis" ? "#1f0707" : "#052e16", border: `1px solid ${b.tip === "cikis" ? "#7f1d1d" : "#14532d"}`, borderRadius: 8, padding: "10px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: b.tip === "cikis" ? "#fca5a5" : "#86efac", fontSize: 13 }}>{b.tip === "cikis" ? "⚠️" : "✅"} {b.mesaj}</span>
          <button onClick={() => setBildirimler(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}>✕</button>
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Toplam Firma",   val: genelIstat.firmaSay,  renk: "#60a5fa", icon: "🏭" },
          { label: "Aktif Personel", val: genelIstat.toplam,    renk: "#a78bfa", icon: "👷" },
          { label: "Kritik",         val: genelIstat.kritik,    renk: "#f87171", icon: "🚨" },
          { label: "Yaklaşıyor",     val: genelIstat.yaklasan,  renk: "#fbbf24", icon: "⚠️" },
          { label: "Güncel",         val: genelIstat.guncel,    renk: "#4ade80", icon: "✅" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#111827", borderRadius: 12, padding: "18px 16px", border: "1px solid #1f2937", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.renk }} />
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: s.renk }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader title="🏭 Firma Özeti" right={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => setModal("personel-guncelle")}>📥 Personel Güncelle</Btn>
            <Btn onClick={() => setModal("firma-ekle")} variant="success">+ Firma Ekle</Btn>
          </div>
        } />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              {["Firma", "Sektör", "Tehlike", "Personel", "Kritik Kayıt", ""].map(h => (
                <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {firmaIstatistik.map((f, i) => (
              <tr key={f.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "transparent" : "#0f172a22" }}>
                <td style={{ padding: "13px 16px", fontWeight: 600, color: "#f9fafb" }}>{f.ad}</td>
                <td style={{ padding: "13px 16px", color: "#9ca3af", fontSize: 13 }}>{f.sektor}</td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{ background: f.t?.bg, color: f.t?.renk, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{f.t?.icon} {f.tehlike_sinifi}</span>
                </td>
                <td style={{ padding: "13px 16px", color: "#d1d5db" }}>👷 {f.personelSay}</td>
                <td style={{ padding: "13px 16px" }}>
                  {f.kritikSay > 0
                    ? <span style={{ background: "#1f0707", color: "#f87171", borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 700 }}>🚨 {f.kritikSay}</span>
                    : <span style={{ color: "#4ade80", fontSize: 13 }}>✅ Temiz</span>}
                </td>
                <td style={{ padding: "13px 16px", display: "flex", gap: 8 }}>
                  <Btn onClick={() => { setSecFirma(f); setSayfa("personel"); }} variant="secondary" style={{ fontSize: 12, padding: "6px 12px" }}>Personel →</Btn>
                  <Btn onClick={() => firmaSil(f.id)} variant="danger" style={{ fontSize: 12, padding: "6px 12px" }}>Sil</Btn>
                </td>
              </tr>
            ))}
            {firmalar.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Henüz firma yok. "+ Firma Ekle" butonuna tıklayın.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );

  const PersonelSayfa = () => {
    const firma = secFirma || firmalar[0];
    const fps = aktifPersonel
      .filter(p => p.firma_id === firma?.id)
      .filter(p => aramaP ? p.ad_soyad.toLowerCase().includes(aramaP.toLowerCase()) || p.tc_no?.includes(aramaP) : true);
    return (
      <div>
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <select value={secFirma?.id || ""} onChange={e => setSecFirma(firmalar.find(f => f.id === Number(e.target.value)))}
            style={{ padding: "10px 14px", background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#e5e7eb", fontSize: 14, minWidth: 220 }}>
            {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
          <input value={aramaP} onChange={e => setAramaP(e.target.value)} placeholder="🔍 İsim veya TC ara..."
            style={{ flex: 1, minWidth: 200, padding: "10px 14px", background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#e5e7eb", fontSize: 14 }} />
          <Btn onClick={() => setModal("personel-guncelle")}>📥 Personel Güncelle</Btn>
        </div>
        <Card>
          <CardHeader title={`👷 ${firma?.ad || ""} — ${fps.length} aktif personel`} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0f172a" }}>
                {["Ad Soyad", "TC No", "Görev", "İşe Giriş", "İSG Eğitimi", "Periyodik Muayene", ""].map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: h === "İSG Eğitimi" || h === "Periyodik Muayene" ? "center" : "left", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fps.map((p, i) => {
                const f = firmalar.find(x => x.id === p.firma_id);
                const isgTarih = sonEgitimBul(p.id, "isg");
                const perTarih = sonMuayeneBul(p.id, "periyodik");
                const isgD = durumHesapla(isgTarih, EGITIM_TURLERI[0].periyotFn(f?.tehlike_sinifi));
                const perD = durumHesapla(perTarih, MUAYENE_TURLERI[0].periyotFn(f?.tehlike_sinifi));
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "transparent" : "#0f172a22" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#f3f4f6" }}>{p.ad_soyad}</td>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12, fontFamily: "monospace" }}>{p.tc_no}</td>
                    <td style={{ padding: "12px 16px", color: "#d1d5db", fontSize: 13 }}>{p.gorev}</td>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 13 }}>{formatTarih(p.ise_giris)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}><Badge d={isgD} tarih={isgTarih} /></td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}><Badge d={perD} tarih={perTarih} /></td>
                    <td style={{ padding: "12px 16px" }}>
                      <Btn onClick={() => { setSecPersonel(p); setAktifTab("egitim"); }} variant="secondary" style={{ fontSize: 12, padding: "6px 12px" }}>Detay</Btn>
                    </td>
                  </tr>
                );
              })}
              {fps.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Personel yok. "Personel Güncelle" ile ekleyin.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  const DOKUMAN_KATEGORILER = [
    { id: "risk", ad: "Risk Değerlendirmesi", icon: "⚠️" },
    { id: "acil", ad: "Acil Durum", icon: "🚨" },
    { id: "isgkurul", ad: "İSG Kurulu", icon: "👥" },
    { id: "plan", ad: "Yıllık Plan & Rapor", icon: "📅" },
    { id: "atama", ad: "Atama & Görevlendirme", icon: "📌" },
    { id: "diger", ad: "Diğer", icon: "📄" },
  ];
  const DURUM_SECENEKLER = ["VAR", "YOK", "İMZADA", "PLANLANACAK", "DEĞİŞECEK"];
  const DURUM_RENKLER = { "VAR": "#4ade80", "YOK": "#f87171", "İMZADA": "#fbbf24", "PLANLANACAK": "#60a5fa", "DEĞİŞECEK": "#fb923c" };

  const DokumanlarSayfa = () => {
    const [secFirmaId, setSecFirmaId] = useState(firmalar[0]?.id || null);
    const [yeniForm, setYeniForm] = useState({ kategori: "risk", baslik: "", durum: "VAR", tarih: "", notlar: "" });
    const [duzenleId, setDuzenleId] = useState(null);
    const [duzenleForm, setDuzenleForm] = useState({});
    const firma = firmalar.find(f => f.id === secFirmaId);
    const firmaDokumanlari = dokumanlar.filter(d => d.firma_id === secFirmaId);

    return (
      <div>
        {/* Firma seç + bilgi */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <select value={secFirmaId || ""} onChange={e => setSecFirmaId(Number(e.target.value))}
            style={{ padding: "10px 14px", background: "#111827", border: "1px solid #374151", borderRadius: 8, color: "#e5e7eb", fontSize: 14, minWidth: 240 }}>
            {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
          {firma && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ background: "#1f2937", borderRadius: 8, padding: "6px 12px", fontSize: 13, color: "#9ca3af" }}>
                {TEHLIKE[firma.tehlike_sinifi]?.icon} {firma.tehlike_sinifi}
              </span>
              {firma.calisansayisi > 0 && <span style={{ background: "#1f2937", borderRadius: 8, padding: "6px 12px", fontSize: 13, color: "#9ca3af" }}>👷 {firma.calisansayisi} çalışan</span>}
              {firma.sorumlu_kisi && <span style={{ background: "#1f2937", borderRadius: 8, padding: "6px 12px", fontSize: 13, color: "#9ca3af" }}>👤 {firma.sorumlu_kisi}</span>}
              {firma.iletisim && <span style={{ background: "#1f2937", borderRadius: 8, padding: "6px 12px", fontSize: 13, color: "#9ca3af" }}>📞 {firma.iletisim}</span>}
            </div>
          )}
          {firma && <Btn onClick={() => setSecFirmaDetay(firma)} variant="secondary" style={{ fontSize: 12, padding: "7px 14px", marginLeft: "auto" }}>✏️ Firma Güncelle</Btn>}
        </div>

        {/* Yeni doküman ekle */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="➕ Yeni Doküman / Kayıt Ekle" />
          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Kategori</label>
              <select value={yeniForm.kategori} onChange={e => setYeniForm(f => ({ ...f, kategori: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", background: "#0f172a", border: "1px solid #374151", borderRadius: 7, color: "#e5e7eb", fontSize: 13 }}>
                {DOKUMAN_KATEGORILER.map(k => <option key={k.id} value={k.id}>{k.icon} {k.ad}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Başlık / Açıklama</label>
              <input value={yeniForm.baslik} onChange={e => setYeniForm(f => ({ ...f, baslik: e.target.value }))} placeholder="Örn: Risk değerlendirmesi yapıldı"
                style={{ width: "100%", padding: "8px 10px", background: "#0f172a", border: "1px solid #374151", borderRadius: 7, color: "#e5e7eb", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Durum</label>
              <select value={yeniForm.durum} onChange={e => setYeniForm(f => ({ ...f, durum: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", background: "#0f172a", border: "1px solid #374151", borderRadius: 7, color: DURUM_RENKLER[yeniForm.durum] || "#e5e7eb", fontSize: 13, fontWeight: 700 }}>
                {DURUM_SECENEKLER.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Tarih</label>
              <input type="date" value={yeniForm.tarih} onChange={e => setYeniForm(f => ({ ...f, tarih: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", background: "#0f172a", border: "1px solid #374151", borderRadius: 7, color: "#e5e7eb", fontSize: 13, boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ padding: "0 16px 16px", display: "flex", gap: 12 }}>
            <input value={yeniForm.notlar} onChange={e => setYeniForm(f => ({ ...f, notlar: e.target.value }))} placeholder="Notlar (isteğe bağlı)"
              style={{ flex: 1, padding: "8px 10px", background: "#0f172a", border: "1px solid #374151", borderRadius: 7, color: "#e5e7eb", fontSize: 13 }} />
            <Btn onClick={async () => {
              if (!yeniForm.baslik || !secFirmaId) return;
              await dokumanKaydet(secFirmaId, yeniForm.kategori, yeniForm.baslik, yeniForm.durum, yeniForm.tarih, yeniForm.notlar);
              setYeniForm({ kategori: "risk", baslik: "", durum: "VAR", tarih: "", notlar: "" });
            }} variant="success" disabled={!yeniForm.baslik}>Ekle</Btn>
          </div>
        </Card>

        {/* Doküman listesi kategoriye göre */}
        {DOKUMAN_KATEGORILER.map(kat => {
          const kayitlar = firmaDokumanlari.filter(d => d.kategori === kat.id);
          if (!kayitlar.length) return null;
          return (
            <Card key={kat.id} style={{ marginBottom: 14 }}>
              <CardHeader title={`${kat.icon} ${kat.ad} (${kayitlar.length})`} />
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0f172a" }}>
                    {["Başlık", "Durum", "Tarih", "Notlar", ""].map(h => (
                      <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kayitlar.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map((k, i) => (
                    <tr key={k.id} style={{ borderTop: "1px solid #1f2937", background: i % 2 === 0 ? "transparent" : "#0f172a22" }}>
                      {duzenleId === k.id ? (
                        <>
                          <td style={{ padding: "8px 16px" }}>
                            <input value={duzenleForm.baslik} onChange={e => setDuzenleForm(f => ({ ...f, baslik: e.target.value }))}
                              style={{ width: "100%", padding: "6px 8px", background: "#0f172a", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", fontSize: 13 }} />
                          </td>
                          <td style={{ padding: "8px 16px" }}>
                            <select value={duzenleForm.durum} onChange={e => setDuzenleForm(f => ({ ...f, durum: e.target.value }))}
                              style={{ padding: "6px 8px", background: "#0f172a", border: "1px solid #374151", borderRadius: 6, color: DURUM_RENKLER[duzenleForm.durum], fontSize: 13, fontWeight: 700 }}>
                              {DURUM_SECENEKLER.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "8px 16px" }}>
                            <input type="date" value={duzenleForm.tarih || ""} onChange={e => setDuzenleForm(f => ({ ...f, tarih: e.target.value }))}
                              style={{ padding: "6px 8px", background: "#0f172a", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", fontSize: 13 }} />
                          </td>
                          <td style={{ padding: "8px 16px" }}>
                            <input value={duzenleForm.notlar || ""} onChange={e => setDuzenleForm(f => ({ ...f, notlar: e.target.value }))}
                              style={{ width: "100%", padding: "6px 8px", background: "#0f172a", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", fontSize: 13 }} />
                          </td>
                          <td style={{ padding: "8px 16px", display: "flex", gap: 6 }}>
                            <Btn variant="success" style={{ fontSize: 12, padding: "5px 10px" }} onClick={async () => { await dokumanGuncelle(k.id, duzenleForm); setDuzenleId(null); }}>✓</Btn>
                            <Btn variant="secondary" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setDuzenleId(null)}>✕</Btn>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: "11px 16px", color: "#f3f4f6", fontSize: 13, fontWeight: 500 }}>{k.baslik}</td>
                          <td style={{ padding: "11px 16px" }}>
                            <span style={{ color: DURUM_RENKLER[k.durum] || "#9ca3af", fontWeight: 700, fontSize: 13 }}>{k.durum}</span>
                          </td>
                          <td style={{ padding: "11px 16px", color: "#9ca3af", fontSize: 13 }}>{formatTarih(k.tarih)}</td>
                          <td style={{ padding: "11px 16px", color: "#6b7280", fontSize: 12 }}>{k.notlar}</td>
                          <td style={{ padding: "11px 16px", display: "flex", gap: 6 }}>
                            <Btn variant="secondary" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => { setDuzenleId(k.id); setDuzenleForm({ baslik: k.baslik, durum: k.durum, tarih: k.tarih || "", notlar: k.notlar || "" }); }}>✏️</Btn>
                            <Btn variant="danger" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => dokumanSil(k.id)}>Sil</Btn>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
        {firmaDokumanlari.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>Bu firma için henüz doküman kaydı yok. Yukarıdan ekleyin.</div>
        )}
      </div>
    );
  };


    const kritikler = aktifPersonel.flatMap(p => {
      const f = firmalar.find(x => x.id === p.firma_id);
      return EGITIM_TURLERI.flatMap(e => {
        const son = sonEgitimBul(p.id, e.id);
        const d = durumHesapla(son, e.periyotFn(f?.tehlike_sinifi));
        return d.onc >= 3 ? [{ p, f, tip: e.ad, icon: e.icon, d }] : [];
      });
    }).sort((a, b) => b.d.onc - a.d.onc);
    return (
      <Card>
        <CardHeader title={`🚨 Kritik Kayıtlar (${kritikler.length})`} />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              {["Personel", "Firma", "Tür", "Durum", ""].map(h => (
                <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kritikler.map((k, i) => (
              <tr key={i} style={{ borderTop: "1px solid #1f2937" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600, color: "#f3f4f6" }}>{k.p.ad_soyad}</td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 13 }}>{k.f?.ad}</td>
                <td style={{ padding: "12px 16px", color: "#d1d5db", fontSize: 13 }}>{k.icon} {k.tip}</td>
                <td style={{ padding: "12px 16px" }}><Badge d={k.d} /></td>
                <td style={{ padding: "12px 16px" }}>
                  <Btn onClick={() => { setSecPersonel(k.p); setAktifTab("egitim"); }} variant="danger" style={{ fontSize: 12, padding: "6px 12px" }}>Güncelle</Btn>
                </td>
              </tr>
            ))}
            {kritikler.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#4ade80" }}>✅ Tüm kayıtlar güncel!</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (oturumYukleniyor) return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#60a5fa", fontSize: 18 }}>
      ⏳ Yükleniyor...
    </div>
  );

  if (!oturum) return <GirisEkrani onGiris={() => veriYukle()} />;

  if (yukleniyor) return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", color: "#60a5fa", fontSize: 18 }}>
      ⏳ Veriler yükleniyor...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e2e8f0" }}>
      <div style={{ background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "0 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", height: 60, gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#f9fafb" }}>İSG Takip Sistemi</div>
              <div style={{ fontSize: 10, color: "#475569" }}>Eğitim · Muayene · Sertifika</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {[["dashboard","📊 Dashboard"],["personel","👷 Personel"],["dokumanlar","📁 Dokümanlar"],["rapor","📋 Raporlar"]].map(([id, label]) => (
              <button key={id} onClick={() => setSayfa(id)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: sayfa === id ? "#1d4ed8" : "transparent", color: sayfa === id ? "#fff" : "#6b7280" }}>{label}</button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#475569" }}>{oturum?.user?.email}</span>
            <Btn onClick={cikisYap} variant="danger" style={{ fontSize: 12, padding: "6px 12px" }}>Çıkış</Btn>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        {sayfa === "dashboard" && <Dashboard />}
        {sayfa === "personel"  && <PersonelSayfa />}
        {sayfa === "dokumanlar" && <DokumanlarSayfa />}
        {sayfa === "rapor"     && <RaporSayfa />}
      </div>
      {modal === "firma-ekle"        && <FirmaEkleModal />}
      {modal === "personel-guncelle" && <PersonelGuncelleModal />}
      {secPersonel && <PersonelDetay p={secPersonel} />}
      {secFirmaDetay && <FirmaGuncelleModal firma={secFirmaDetay} />}
    </div>
  );
}
