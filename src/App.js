import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabase";

// ─── SABITLER ────────────────────────────────────────────────────────────────
const TEHLIKE = {
  "Az Tehlikeli":  { renk: "#4ade80", bg: "#052e16", sure: 36, icon: "🟢", egitim1Saat: 8, egitim2Saat: 0,  toplamSaat: 8  },
  "Tehlikeli":     { renk: "#fbbf24", bg: "#1c1403", sure: 24, icon: "🟡", egitim1Saat: 8, egitim2Saat: 4,  toplamSaat: 12 },
  "Çok Tehlikeli": { renk: "#f87171", bg: "#1f0707", sure: 12, icon: "🔴", egitim1Saat: 8, egitim2Saat: 8,  toplamSaat: 16 },
};
// EGITIM_TURLERI artık Supabase'den yükleniyor (aşağıda state olarak)
const MUAYENE_TURLERI = [
  { id: "periyodik", ad: "Periyodik Sağlık Muayenesi", icon: "🩺", periyotFn: (t) => t === "Az Tehlikeli" ? 60 : t === "Tehlikeli" ? 36 : t === "Çok Tehlikeli" ? 12 : 36 },
  { id: "ise_giris", ad: "İşe Giriş Muayenesi",        icon: "📋", periyotFn: () => null },
];
const SERTIFIKA_TURLERI = [
  { id: "forklift", ad: "Forklift Operatörü",    icon: "🚜", periyot: 60 },
  { id: "vinc",     ad: "Vinç Operatörü",         icon: "🏗", periyot: 60 },
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
const durumHesapla = (sonTarih, periyot, eksikLabel = "Eğitim Eksik") => {
  if (!sonTarih || !periyot) return { label: eksikLabel, renk: "#e74c3c", bg: "#fdedec", onc: 5 };
  const sonraki = sonrakiTarih(sonTarih, periyot);
  const gun = gunFarki(sonraki);
  if (gun < 0)   return { label: "Süresi Dolmuş", renk: "#e74c3c", bg: "#fdedec", onc: 4 };
  if (gun <= 30)  return { label: "Kritik",         renk: "#e67e22", bg: "#fdf2e9", onc: 3 };
  if (gun <= 90)  return { label: "Yaklaşıyor",     renk: "#d4ac0d", bg: "#fef9e7", onc: 2 };
  return               { label: "Güncel",           renk: "#27ae60", bg: "#eafaf1", onc: 1 };
};

// ─── UI BİLEŞENLERİ ──────────────────────────────────────────────────────────
const Badge = ({ d, tarih }) => (
  <div style={{ textAlign: "center", minWidth: 90 }}>
    <span style={{ background: d.bg, color: d.renk, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, display: "inline-block" }}>{d.label}</span>
    {tarih && <div style={{ fontSize: 11, color: "#ADB5BD", marginTop: 3 }}>{formatTarih(tarih)}</div>}
  </div>
);
const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false, type = "button" }) => (
  <button type={type} onClick={onClick} disabled={disabled} style={{
    padding: "8px 16px", borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13, fontWeight: 600, opacity: disabled ? 0.5 : 1,
    background: variant === "primary" ? "#233142" : variant === "danger" ? "#e74c3c" : variant === "success" ? "#2ecc71" : "#ecf0f1",
    color: variant === "secondary" ? "#454545" : "#fff", ...style
  }}>{children}</button>
);
const Card = ({ children, style = {} }) => (
  <div style={{ background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px #0000000a", ...style }}>{children}</div>
);
const CardHeader = ({ title, right }) => (
  <div style={{ padding: "14px 20px", borderBottom: "1px solid #dde3e0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F4F7F6" }}>
    <span style={{ fontWeight: 700, color: "#454545", fontSize: 15 }}>{title}</span>
    {right}
  </div>
);
const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 13, color: "#454545", marginBottom: 5 }}>{label}</label>}
    <input {...props} style={{ width: "100%", padding: "10px 14px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14, boxSizing: "border-box" }} />
  </div>
);
const Select = ({ label, children, ...props }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 13, color: "#454545", marginBottom: 5 }}>{label}</label>}
    <select {...props} style={{ width: "100%", padding: "10px 14px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14 }}>{children}</select>
  </div>
);
const Modal = ({ children, onClose, title, width = 500 }) => (
  <div style={{ position: "fixed", inset: 0, background: "#0006", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 10, width, maxHeight: "90vh", overflowY: "auto", padding: 28, boxShadow: "0 20px 60px #0000002a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontWeight: 800, fontSize: 18, color: "#454545" }}>{title}</span>
        <button onClick={onClose} style={{ background: "#F4F7F6", border: "none", color: "#ADB5BD", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 18 }}>✕</button>
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
    <div style={{ minHeight: "100vh", background: "#233142", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ width: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 10, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>🛡️</div>
          <div style={{ fontWeight: 800, fontSize: 24, color: "#ffffff" }}>İSG Takip Sistemi</div>
          <div style={{ fontSize: 14, color: "#ADB5BD", marginTop: 4 }}>İş Sağlığı & Güvenliği Yönetimi</div>
        </div>

        {/* Form */}
        <div style={{ background: "#ffffff", border: "none", borderRadius: 10, padding: 32, boxShadow: "0 20px 60px #00000033" }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#454545", marginBottom: 24 }}>Giriş Yap</div>

          <form onSubmit={girisYap}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#454545", marginBottom: 6 }}>E-posta</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@sirket.com" required
                style={{ width: "100%", padding: "12px 14px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, color: "#454545", marginBottom: 6 }}>Şifre</label>
              <input type="password" value={sifre} onChange={e => setSifre(e.target.value)} placeholder="••••••••" required
                style={{ width: "100%", padding: "12px 14px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            {hata && (
              <div style={{ background: "#fdedec", border: "1px solid #f5b7b1", borderRadius: 8, padding: "10px 14px", color: "#e74c3c", fontSize: 13, marginBottom: 16 }}>
                ⚠️ {hata}
              </div>
            )}

            <button type="submit" disabled={yukleniyor} style={{
              width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: yukleniyor ? "not-allowed" : "pointer",
              background: "#233142", color: "#fff", fontSize: 15, fontWeight: 700, opacity: yukleniyor ? 0.7 : 1
            }}>
              {yukleniyor ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#ADB5BD" }}>
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
  const [egitimTurleri, setEgitimTurleri] = useState([]);
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
    const [f, p, e, m, s, d, et] = await Promise.all([
      supabase.from("firmalar").select("*").order("ad"),
      supabase.from("personel").select("*").order("ad_soyad"),
      supabase.from("egitimler").select("*"),
      supabase.from("muayeneler").select("*"),
      supabase.from("sertifikalar").select("*"),
      supabase.from("dokumanlar").select("*"),
      supabase.from("egitim_turleri").select("*").eq("aktif", true).order("id"),
    ]);
    if (f.data) setFirmalar(f.data);
    if (p.data) setPersonel(p.data);
    if (e.data) setEgitimler(e.data);
    if (m.data) setMuayeneler(m.data);
    if (s.data) setSertifikalar(s.data);
    if (d.data) setDokumanlar(d.data);
    if (et.data) setEgitimTurleri(et.data.map(t => ({
      ...t,
      periyotFn: () => t.periyot,
    })));
    setYukleniyor(false);
  };

  // ─── HESAPLAMALAR ──────────────────────────────────────────────────────────
  const aktifPersonel = useMemo(() => personel.filter(p => p.aktif), [personel]);

  const sonEgitimBul = (personelId, tur) => {
    const turStr = String(tur);
    // egitimTurleri'nde bu tur'a karşılık gelen entry'yi bul (hem id hem eski string adla)
    const etEntry = egitimTurleri.find(e =>
      String(e.id) === turStr || (e.ad_slug && e.ad_slug === turStr)
    );
    const kayitlar = egitimler.filter(e => {
      if (e.personel_id !== personelId) return false;
      const kayitTur = String(e.egitim_turu);
      if (kayitTur === turStr) return true;
      // Numeric ID ile eşleştir
      if (etEntry && kayitTur === String(etEntry.id)) return true;
      return false;
    });
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
    let egitimKritik = 0, muayeneKritik = 0;
    // Ana sayfada sadece İSG eğitimi (ilk eğitim türü) gösterilir
    const isgTur = egitimTurleri[0];
    fps.forEach(p => {
      if (isgTur) {
        const d = durumHesapla(sonEgitimBul(p.id, String(isgTur.id)), isgTur.periyotFn(f.tehlike_sinifi), "Eğitim Eksik");
        if (d.onc >= 3) egitimKritik++;
      }
      MUAYENE_TURLERI.forEach(m => {
        const periyot = m.periyotFn(f.tehlike_sinifi);
        if (!periyot) return;
        const d = durumHesapla(sonMuayeneBul(p.id, m.id), periyot, "Muayene Eksik");
        if (d.onc >= 3) muayeneKritik++;
      });
    });
    const evrakEksik = dokumanlar.filter(d => d.firma_id === f.id && (d.durum === "YOK" || d.durum === "PLANLANACAK")).length;
    const kritikSay = egitimKritik + muayeneKritik;
    return { ...f, t: TEHLIKE[f.tehlike_sinifi] || TEHLIKE["Tehlikeli"], personelSay: fps.length, kritikSay, egitimKritik, muayeneKritik, evrakEksik };
  }), [firmalar, aktifPersonel, egitimler, muayeneler, dokumanlar, egitimTurleri]);

  const genelIstat = useMemo(() => {
    let kritik = 0, yaklasan = 0, guncel = 0;
    const isgTur = egitimTurleri[0]; // Sadece İSG Temel Eğitimi (ilk tür)
    aktifPersonel.forEach(p => {
      const f = firmalar.find(x => x.id === p.firma_id);
      if (!f || !isgTur) return;
      const d = durumHesapla(sonEgitimBul(p.id, isgTur.id), isgTur.periyotFn(f.tehlike_sinifi), "Eğitim Eksik");
      if (d.onc >= 3) kritik++;
      else if (d.onc === 2) yaklasan++;
      else if (d.onc === 1) guncel++;
    });
    return { toplam: aktifPersonel.length, firmaSay: firmalar.length, kritik, yaklasan, guncel };
  }, [aktifPersonel, firmalar, egitimler, egitimTurleri]);

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
        <div style={{ padding: "12px 16px", background: "#F4F7F6", borderRadius: 8, fontSize: 12, color: "#ADB5BD", marginBottom: 16 }}>
          {TEHLIKE[form.tehlike_sinifi]?.icon} Eğitim periyodu: Her <strong style={{ color: "#233142" }}>{TEHLIKE[form.tehlike_sinifi]?.sure} ayda</strong> bir
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


  const ImportModal = () => (
    <Modal title="📥 Aylık Personel Listesi Güncelle" onClose={() => { setModal(null); setKarsilastirSonuc(null); setImportMetin(""); }} width={580}>
      <div style={{ fontSize: 13, color: "#ADB5BD", marginBottom: 16 }}>Yeni listeyi yükleyin. Çıkanlar pasife alınır, yeniler eklenir.</div>
      <Select label="Firma" value={secFirma?.id || ""} onChange={e => setSecFirma(firmalar.find(f => f.id === Number(e.target.value)))}>
        <option value="">-- Firma Seçin --</option>
        {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
      </Select>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 13, color: "#ADB5BD", marginBottom: 6 }}>CSV Dosyası <span style={{ color: "#ADB5BD" }}>(TC No, Ad Soyad, Görev)</span></label>
        <input ref={dosyaRef} type="file" accept=".csv,.txt" onChange={e => {
          const file = e.target.files[0];
          if (file) { const r = new FileReader(); r.onload = ev => setImportMetin(ev.target.result); r.readAsText(file, "UTF-8"); }
        }} style={{ display: "none" }} />
        <Btn onClick={() => dosyaRef.current.click()} variant="secondary">📁 Dosya Seç</Btn>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 13, color: "#ADB5BD", marginBottom: 6 }}>veya yapıştırın</label>
        <div style={{ fontSize: 12, color: "#454545", marginBottom: 6 }}>Format: <span style={{ color: "#233142", fontFamily: "monospace" }}>TC No · Ad Soyad · Görev · İşe Giriş Tarihi</span> (Tab veya virgülle ayrılmış)</div>
        <textarea value={importMetin} onChange={e => setImportMetin(e.target.value)} rows={6}
          placeholder={"TC No\tAd Soyad\tGörev\tİşe Giriş\n12345678901\tAhmet Yılmaz\tOperatör\t15.06.2023\n98765432101\tAyşe Kaya\tMühendis\t01.03.2024"}
          style={{ width: "100%", padding: "10px 14px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "monospace" }} />
      </div>
      {karsilastirSonuc && (
        <div style={{ background: "#ffffff", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "#454545", marginBottom: 12 }}>📊 Karşılaştırma Sonucu</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ background: "#fdedec", borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#e74c3c", fontWeight: 700, marginBottom: 6 }}>🚪 Çıkan ({karsilastirSonuc.cikmis.length})</div>
              {karsilastirSonuc.cikmis.map(c => <div key={c.id} style={{ fontSize: 12, color: "#e74c3c" }}>{c.ad_soyad}</div>)}
              {!karsilastirSonuc.cikmis.length && <div style={{ fontSize: 12, color: "#ADB5BD" }}>Çıkan yok</div>}
            </div>
            <div style={{ background: "#052e16", borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#27ae60", fontWeight: 700, marginBottom: 6 }}>🆕 Yeni ({karsilastirSonuc.gelen.length})</div>
              {karsilastirSonuc.gelen.map((g, i) => <div key={i} style={{ fontSize: 12, color: "#86efac" }}>{g.ad}</div>)}
              {!karsilastirSonuc.gelen.length && <div style={{ fontSize: 12, color: "#ADB5BD" }}>Yeni yok</div>}
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
        <div style={{ fontSize: 13, color: "#ADB5BD", marginBottom: 16 }}>
          {p.gorev} · {firma?.ad} · TC: {p.tc_no} · İşe Giriş: {formatTarih(p.ise_giris)}
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#ecf0f1", borderRadius: 10, padding: 4 }}>
          {[["egitim","🛡️ Eğitimler"],["muayene","🩺 Muayeneler"],["sertifika","📜 Sertifikalar"]].map(([id, label]) => (
            <button key={id} onClick={() => setAktifTab(id)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: aktifTab === id ? "#233142" : "transparent", color: aktifTab === id ? "#fff" : "#6b7280" }}>{label}</button>
          ))}
        </div>
        {aktifTab === "egitim" && egitimTurleri.map(e => {
          const periyot = e.periyotFn(firma?.tehlike_sinifi);
          const tumKayitlar = egitimler.filter(x => x.personel_id === p.id && String(x.egitim_turu) === String(e.id)).sort((a,b) => new Date(b.egitim_tarihi) - new Date(a.egitim_tarihi));
          const son = tumKayitlar[0]?.egitim_tarihi || null;
          const tehlikeSinifi = TEHLIKE[firma?.tehlike_sinifi];
          const ikincEgitimGerekli = tehlikeSinifi?.egitim2Saat > 0;
          // Eğitim1 ve Eğitim2 kayıtlarını bul
          const kayit1 = tumKayitlar.find(k => k.egitim_no === 1) || (tumKayitlar.length > 0 ? tumKayitlar[tumKayitlar.length - 1] : null);
          const kayit2 = tumKayitlar.find(k => k.egitim_no === 2) || (tumKayitlar.length > 1 ? tumKayitlar.find(k => k !== kayit1) : null);
          // Tamamlanma ve geçerlilik hesabı
          const egitimTamamlandi = ikincEgitimGerekli ? (kayit1 && kayit2) : !!kayit1;
          const sonTarihDetay = egitimTamamlandi
            ? [kayit1?.egitim_tarihi, kayit2?.egitim_tarihi].filter(Boolean).sort((a,b)=>new Date(b)-new Date(a))[0]
            : null;
          const d = durumHesapla(sonTarihDetay, periyot, "Eğitim Eksik");
          return (
            <div key={e.id} style={{ background: "#ffffff", borderRadius: 10, padding: 14, marginBottom: 10, border: "1px solid #dde3e0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{e.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#233142" }}>{e.ad}</div>
                  <div style={{ fontSize: 12, color: "#ADB5BD" }}>Sonraki: {formatTarih(sonrakiTarih(sonTarihDetay, periyot))}</div>
                </div>
                <Badge d={d} tarih={sonTarihDetay} />
              </div>
              {/* Eğitim 1 */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#ADB5BD", marginBottom: 4, fontWeight: 600 }}>
                  EĞİTİM 1 {tehlikeSinifi ? `(${tehlikeSinifi.egitim1Saat} saat)` : ""}
                  {kayit1 && <span style={{ color: "#27ae60", marginLeft: 8 }}>✅ {formatTarih(kayit1.egitim_tarihi)}</span>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="date" value={tarihler[`${e.id}_1`] || ""} onChange={ev => setTarihler(t => ({ ...t, [`${e.id}_1`]: ev.target.value }))}
                    style={{ flex: 1, padding: "7px 12px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 7, color: tarihler[`${e.id}_1`] ? "#454545" : "#6b7280", fontSize: 13 }} />
                  <Btn variant="success" style={{ padding: "7px 14px", opacity: tarihler[`${e.id}_1`] ? 1 : 0.4 }} disabled={!tarihler[`${e.id}_1`]} onClick={async () => {
                    const tarih = tarihler[`${e.id}_1`];
                    if (kayit1) await supabase.from("egitimler").update({ egitim_tarihi: tarih }).eq("id", kayit1.id);
                    else await supabase.from("egitimler").insert({ personel_id: p.id, egitim_turu: String(e.id), egitim_tarihi: tarih, egitim_no: 1 });
                    await veriYukle();
                    setTarihler(t => ({ ...t, [`${e.id}_1`]: "" }));
                  }}>Kaydet</Btn>
                  {kayit1 && <button onClick={() => egitimSil(kayit1.id)} style={{ background: "#fdedec", border: "1px solid #f5b7b1", color: "#e74c3c", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Sil</button>}
                </div>
              </div>
              {/* Eğitim 2 — sadece gerekli tehlike sınıflarında göster */}
              {ikincEgitimGerekli && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 11, color: "#ADB5BD", marginBottom: 4, fontWeight: 600 }}>
                    EĞİTİM 2 {tehlikeSinifi ? `(${tehlikeSinifi.egitim2Saat} saat)` : ""}
                    {kayit2 && <span style={{ color: "#27ae60", marginLeft: 8 }}>✅ {formatTarih(kayit2.egitim_tarihi)}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="date" value={tarihler[`${e.id}_2`] || ""} onChange={ev => setTarihler(t => ({ ...t, [`${e.id}_2`]: ev.target.value }))}
                      style={{ flex: 1, padding: "7px 12px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 7, color: tarihler[`${e.id}_2`] ? "#454545" : "#6b7280", fontSize: 13 }} />
                    <Btn variant="success" style={{ padding: "7px 14px", opacity: tarihler[`${e.id}_2`] ? 1 : 0.4 }} disabled={!tarihler[`${e.id}_2`]} onClick={async () => {
                      const tarih = tarihler[`${e.id}_2`];
                      if (kayit2) await supabase.from("egitimler").update({ egitim_tarihi: tarih }).eq("id", kayit2.id);
                      else await supabase.from("egitimler").insert({ personel_id: p.id, egitim_turu: String(e.id), egitim_tarihi: tarih, egitim_no: 2 });
                      await veriYukle();
                      setTarihler(t => ({ ...t, [`${e.id}_2`]: "" }));
                    }}>Kaydet</Btn>
                    {kayit2 && <button onClick={() => egitimSil(kayit2.id)} style={{ background: "#fdedec", border: "1px solid #f5b7b1", color: "#e74c3c", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Sil</button>}
                  </div>
                </div>
              )}
              {/* Geçmiş kayıtlar (ekstra kayıtlar varsa) */}
              {tumKayitlar.length > 2 && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => setGecmisAc(g => ({ ...g, [e.id]: !g[e.id] }))} style={{ background: "none", border: "none", color: "#ADB5BD", fontSize: 12, cursor: "pointer", padding: "2px 0" }}>
                    {gecmisAc[e.id] ? "▲ Geçmişi gizle" : `▼ Geçmiş kayıtlar (${tumKayitlar.length})`}
                  </button>
                  {gecmisAc[e.id] && (
                    <div style={{ marginTop: 8, borderTop: "1px solid #dde3e0", paddingTop: 8 }}>
                      {tumKayitlar.map((k, i) => (
                        <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: i < tumKayitlar.length-1 ? "1px solid #f0f0f0" : "none" }}>
                          <span style={{ fontSize: 13, color: i === 0 ? "#4ade80" : "#9ca3af" }}>{i === 0 ? "✅ " : "  "}{formatTarih(k.egitim_tarihi)} {k.egitim_no ? `(Eğitim ${k.egitim_no})` : ""}</span>
                          <button onClick={() => egitimSil(k.id)} style={{ background: "#fdedec", border: "1px solid #f5b7b1", color: "#e74c3c", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>Sil</button>
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
          const d = durumHesapla(son, periyot, "Muayene Eksik");
          return (
            <div key={m.id} style={{ background: "#ffffff", borderRadius: 10, padding: 14, marginBottom: 10, border: "1px solid #dde3e0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#233142" }}>{m.ad}</div>
                  <div style={{ fontSize: 12, color: "#ADB5BD" }}>{periyot ? `Sonraki: ${formatTarih(sonrakiTarih(son, periyot))}` : "Tek seferlik"}</div>
                </div>
                {periyot && <Badge d={d} tarih={son} />}
                {!periyot && son && <span style={{ fontSize: 12, color: "#27ae60" }}>✅ {formatTarih(son)}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: tumKayitlar.length > 0 ? 8 : 0 }}>
                <input type="date" value={tarihler[`m_${m.id}`] || ""} onChange={ev => setTarihler(t => ({ ...t, [`m_${m.id}`]: ev.target.value }))}
                  style={{ flex: 1, padding: "7px 12px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 7, color: tarihler[`m_${m.id}`] ? "#e5e7eb" : "#6b7280", fontSize: 13 }} />
                <Btn variant="success" style={{ padding: "7px 14px", opacity: tarihler[`m_${m.id}`] ? 1 : 0.4 }} disabled={!tarihler[`m_${m.id}`]} onClick={() => { muayeneKaydet(p.id, m.id, tarihler[`m_${m.id}`]); setTarihler(t => ({ ...t, [`m_${m.id}`]: "" })); }}>Kaydet</Btn>
              </div>
              {tumKayitlar.length > 0 && (
                <div>
                  <button onClick={() => setGecmisAc(g => ({ ...g, [`m_${m.id}`]: !g[`m_${m.id}`] }))} style={{ background: "none", border: "none", color: "#ADB5BD", fontSize: 12, cursor: "pointer", padding: "2px 0" }}>
                    {gecmisAc[`m_${m.id}`] ? "▲ Geçmişi gizle" : `▼ Geçmiş kayıtlar (${tumKayitlar.length})`}
                  </button>
                  {gecmisAc[`m_${m.id}`] && (
                    <div style={{ marginTop: 8, borderTop: "1px solid #dde3e0", paddingTop: 8 }}>
                      {tumKayitlar.map((k, i) => (
                        <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: i < tumKayitlar.length-1 ? "1px solid #1f2937" : "none" }}>
                          <span style={{ fontSize: 13, color: i === 0 ? "#4ade80" : "#9ca3af" }}>{i === 0 ? "✅ " : "  "}{formatTarih(k.muayene_tarihi)}</span>
                          <button onClick={() => muayeneSil(k.id)} style={{ background: "#fdedec", border: "1px solid #f5b7b1", color: "#e74c3c", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>Sil</button>
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
          const d = durumHesapla(son, s.periyot, "Sertifika Eksik");
          return (
            <div key={s.id} style={{ background: "#ffffff", borderRadius: 10, padding: 14, marginBottom: 10, border: "1px solid #dde3e0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#233142" }}>{s.ad}</div>
                  <div style={{ fontSize: 12, color: "#ADB5BD" }}>Periyot: {s.periyot} ay{son ? ` · Sonraki: ${formatTarih(sonrakiTarih(son, s.periyot))}` : ""}</div>
                </div>
                {son && <Badge d={d} tarih={son} />}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: tumKayitlar.length > 0 ? 8 : 0 }}>
                <input type="date" value={tarihler[`s_${s.id}`] || ""} onChange={ev => setTarihler(t => ({ ...t, [`s_${s.id}`]: ev.target.value }))}
                  style={{ flex: 1, padding: "7px 12px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 7, color: tarihler[`s_${s.id}`] ? "#e5e7eb" : "#6b7280", fontSize: 13 }} />
                <Btn variant="success" style={{ padding: "7px 14px", opacity: tarihler[`s_${s.id}`] ? 1 : 0.4 }} disabled={!tarihler[`s_${s.id}`]} onClick={() => { sertifikaKaydet(p.id, s.id, tarihler[`s_${s.id}`]); setTarihler(t => ({ ...t, [`s_${s.id}`]: "" })); }}>Kaydet</Btn>
              </div>
              {tumKayitlar.length > 0 && (
                <div>
                  <button onClick={() => setGecmisAc(g => ({ ...g, [`s_${s.id}`]: !g[`s_${s.id}`] }))} style={{ background: "none", border: "none", color: "#ADB5BD", fontSize: 12, cursor: "pointer", padding: "2px 0" }}>
                    {gecmisAc[`s_${s.id}`] ? "▲ Geçmişi gizle" : `▼ Geçmiş kayıtlar (${tumKayitlar.length})`}
                  </button>
                  {gecmisAc[`s_${s.id}`] && (
                    <div style={{ marginTop: 8, borderTop: "1px solid #dde3e0", paddingTop: 8 }}>
                      {tumKayitlar.map((k, i) => (
                        <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: i < tumKayitlar.length-1 ? "1px solid #1f2937" : "none" }}>
                          <span style={{ fontSize: 13, color: i === 0 ? "#4ade80" : "#9ca3af" }}>{i === 0 ? "✅ " : "  "}{formatTarih(k.verilis_tarihi)}</span>
                          <button onClick={() => sertifikaSil(k.id)} style={{ background: "#fdedec", border: "1px solid #f5b7b1", color: "#e74c3c", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>Sil</button>
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
          <button onClick={() => setBildirimler(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#ADB5BD", cursor: "pointer" }}>✕</button>
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
          <div key={i} style={{ background: "#ffffff", borderRadius: 12, padding: "18px 16px", border: "1px solid #dde3e0", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.renk }} />
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: s.renk }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "#ADB5BD", marginTop: 2 }}>{s.label}</div>
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
            <tr style={{ background: "#F4F7F6" }}>
              {["Firma", "Sektör", "Tehlike", "Personel", "Eğitim", "Sağlık", "Evrak", ""].map(h => (
                <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {firmaIstatistik.map((f, i) => (
              <tr key={f.id} style={{ borderTop: "1px solid #dde3e0", background: i % 2 === 0 ? "transparent" : "#F4F7F633" }}>
                <td style={{ padding: "13px 16px", fontWeight: 600, color: "#233142" }}>{f.ad}</td>
                <td style={{ padding: "13px 16px", color: "#ADB5BD", fontSize: 13 }}>{f.sektor}</td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{ background: f.t?.bg, color: f.t?.renk, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{f.t?.icon} {f.tehlike_sinifi}</span>
                </td>
                <td style={{ padding: "13px 16px", color: "#ADB5BD" }}>👷 {f.personelSay}</td>
                <td style={{ padding: "13px 16px" }}>
                  {f.egitimKritik > 0
                    ? <span style={{ background: "#fdedec", color: "#e74c3c", borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 700 }}>🚨 {f.egitimKritik}</span>
                    : <span style={{ color: "#27ae60", fontSize: 13 }}>✅ Uygun</span>}
                </td>
                <td style={{ padding: "13px 16px" }}>
                  {f.muayeneKritik > 0
                    ? <span style={{ background: "#fdedec", color: "#e74c3c", borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 700 }}>🚨 {f.muayeneKritik}</span>
                    : <span style={{ color: "#27ae60", fontSize: 13 }}>✅ Uygun</span>}
                </td>
                <td style={{ padding: "13px 16px" }}>
                  {f.evrakEksik > 0
                    ? <span style={{ background: "#1c1403", color: "#d97706", borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 700 }}>⚠️ {f.evrakEksik}</span>
                    : <span style={{ color: "#27ae60", fontSize: 13 }}>✅ Uygun</span>}
                </td>
                <td style={{ padding: "13px 16px", display: "flex", gap: 8 }}>
                  <Btn onClick={() => { setSecFirma(f); setSayfa("personel"); }} variant="secondary" style={{ fontSize: 12, padding: "6px 12px" }}>Personel →</Btn>
                  <Btn onClick={() => firmaSil(f.id)} variant="danger" style={{ fontSize: 12, padding: "6px 12px" }}>Sil</Btn>
                </td>
              </tr>
            ))}
            {firmalar.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#ADB5BD" }}>Henüz firma yok. "+ Firma Ekle" butonuna tıklayın.</td></tr>
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
            style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14, minWidth: 220 }}>
            {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
          <input value={aramaP} onChange={e => setAramaP(e.target.value)} placeholder="🔍 İsim veya TC ara..."
            style={{ flex: 1, minWidth: 200, padding: "10px 14px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14 }} />
          <Btn onClick={() => setModal("personel-guncelle")}>📥 Personel Güncelle</Btn>
        </div>
        <Card>
          <CardHeader title={`👷 ${firma?.ad || ""} — ${fps.length} aktif personel`} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F4F7F6" }}>
                {["Ad Soyad", "TC No", "Görev", "İşe Giriş", "İSG Eğitimi", "Periyodik Muayene", ""].map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: h === "İSG Eğitimi" || h === "Periyodik Muayene" ? "center" : "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fps.map((p, i) => {
                const f = firmalar.find(x => x.id === p.firma_id);
                const isgTur = egitimTurleri[0];
                const isgTarih = isgTur ? sonEgitimBul(p.id, String(isgTur.id)) : null;
                const perTarih = sonMuayeneBul(p.id, "periyodik");
                const isgD = durumHesapla(isgTarih, egitimTurleri[0]?.periyotFn(f?.tehlike_sinifi), "Eğitim Eksik");
                const perD = durumHesapla(perTarih, MUAYENE_TURLERI[0].periyotFn(f?.tehlike_sinifi), "Muayene Eksik");
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #dde3e0", background: i % 2 === 0 ? "transparent" : "#F4F7F633" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#233142" }}>{p.ad_soyad}</td>
                    <td style={{ padding: "12px 16px", color: "#ADB5BD", fontSize: 12, fontFamily: "monospace" }}>{p.tc_no}</td>
                    <td style={{ padding: "12px 16px", color: "#ADB5BD", fontSize: 13 }}>{p.gorev}</td>
                    <td style={{ padding: "12px 16px", color: "#ADB5BD", fontSize: 13 }}>{formatTarih(p.ise_giris)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}><Badge d={isgD} tarih={isgTarih} /></td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}><Badge d={perD} tarih={perTarih} /></td>
                    <td style={{ padding: "12px 16px" }}>
                      <Btn onClick={() => { setSecPersonel(p); setAktifTab("egitim"); }} variant="secondary" style={{ fontSize: 12, padding: "6px 12px" }}>Detay</Btn>
                    </td>
                  </tr>
                );
              })}
              {fps.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#ADB5BD" }}>Personel yok. "Personel Güncelle" ile ekleyin.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  const DOKUMAN_KATEGORILER = [
    { id: "risk",      ad: "Risk Değerlendirmesi",      icon: "⚠️" },
    { id: "acil",      ad: "Acil Durum",                icon: "🚨" },
    { id: "tespit",    ad: "Tespit ve Öneri",           icon: "📝" },
    { id: "calisan",   ad: "Çalışan Temsilcisi",        icon: "🙋" },
    { id: "plan",      ad: "Yıllık Plan & Rapor",       icon: "📅" },
    { id: "isgkurul",  ad: "İSG Kurulu",                icon: "👥" },
    { id: "tatbikat",  ad: "Tatbikat",                  icon: "🧯" },
    { id: "diger",     ad: "Diğer",                     icon: "📄" },
  ];
  // Standart doküman şablonları — tehlike sınıfına göre geçerlilik süresi (ay), null = süresiz
  const STANDART_DOKUMANLAR = [
    // Risk
    { kategori: "risk",     baslik: "Risk Değerlendirmesi",                periyot: { "Çok Tehlikeli": 24, "Tehlikeli": 48, "Az Tehlikeli": 72 } },
    { kategori: "risk",     baslik: "Risk Değerlendirmesi Ekibi Atama Yazısı", periyot: null },
    // Acil Durum
    { kategori: "acil",     baslik: "Acil Durum Eylem Planı",              periyot: { "Çok Tehlikeli": 24, "Tehlikeli": 48, "Az Tehlikeli": 72 } },
    { kategori: "acil",     baslik: "Acil Durum Ekipleri Atama Yazısı",    periyot: null },
    { kategori: "acil",     baslik: "Acil Durum Ekibi Eğitimleri",         periyot: null },
    // Tespit
    { kategori: "tespit",   baslik: "Tespit ve Öneri Defteri",             periyot: null },
    // Çalışan Temsilcisi
    { kategori: "calisan",  baslik: "Çalışan Temsilcisi Atama Yazısı",     periyot: null },
    { kategori: "calisan",  baslik: "Çalışan Temsilcisi Eğitimi",          periyot: null },
    // Yıllık Plan
    { kategori: "plan",     baslik: "Yıllık Eğitim Planı",                 periyot: { "Çok Tehlikeli": 12, "Tehlikeli": 12, "Az Tehlikeli": 12 } },
    { kategori: "plan",     baslik: "Yıllık Çalışma Planı",                periyot: { "Çok Tehlikeli": 12, "Tehlikeli": 12, "Az Tehlikeli": 12 } },
    { kategori: "plan",     baslik: "Yıllık Değerlendirme Planı",          periyot: { "Çok Tehlikeli": 12, "Tehlikeli": 12, "Az Tehlikeli": 12 } },
    // İSG Kurulu
    { kategori: "isgkurul", baslik: "İSG Kurulu Tarihi",                   periyot: { "Çok Tehlikeli": 12, "Tehlikeli": 24, "Az Tehlikeli": 24 } },
    { kategori: "isgkurul", baslik: "İSG Kurul Ekibi Atama Yazısı",        periyot: null },
    { kategori: "isgkurul", baslik: "İSG Kurul Ekibi Eğitimi",             periyot: null },
    // Tatbikat
    { kategori: "tatbikat", baslik: "Acil Durum Tatbikatı",                periyot: { "Çok Tehlikeli": 12, "Tehlikeli": 12, "Az Tehlikeli": 12 } },
  ];
  const DURUM_SECENEKLER = ["VAR", "YOK", "İMZADA", "PLANLANACAK", "DEĞİŞECEK"];
  const DURUM_RENKLER = { "VAR": "#4ade80", "YOK": "#f87171", "İMZADA": "#fbbf24", "PLANLANACAK": "#60a5fa", "DEĞİŞECEK": "#fb923c" };

  const DokumanlarSayfa = () => {
    const [secFirmaId, setSecFirmaId] = useState(firmalar[0]?.id || null);
    const [yeniForm, setYeniForm] = useState({ kategori: "diger", baslik: "", durum: "VAR", tarih: "", notlar: "" });
    const [yeniFormAc, setYeniFormAc] = useState(false);
    const [duzenleId, setDuzenleId] = useState(null);
    const [duzenleForm, setDuzenleForm] = useState({});
    const firma = firmalar.find(f => f.id === secFirmaId);
    const tehlike = firma?.tehlike_sinifi || "Tehlikeli";
    const firmaDokumanlari = dokumanlar.filter(d => d.firma_id === secFirmaId);

    // Her standart doküman için DB kaydını bul
    const standartSatirlar = STANDART_DOKUMANLAR.map(sd => {
      const kayit = firmaDokumanlari.find(d => d.baslik === sd.baslik && d.kategori === sd.kategori);
      const periyotAy = sd.periyot ? (sd.periyot[tehlike] || null) : null;
      // Geçerlilik durumu hesapla
      let gecerlilik = null;
      if (kayit && kayit.tarih && periyotAy) {
        const gun = gunFarki(sonrakiTarih(kayit.tarih, periyotAy));
        if (gun < 0)   gecerlilik = { label: "Süresi Doldu", renk: "#e74c3c", bg: "#fdedec" };
        else if (gun <= 30)  gecerlilik = { label: "Kritik", renk: "#e67e22", bg: "#fdf2e9" };
        else if (gun <= 90)  gecerlilik = { label: "Yaklaşıyor", renk: "#d4ac0d", bg: "#fef9e7" };
        else gecerlilik = { label: "Güncel", renk: "#27ae60", bg: "#eafaf1" };
      }
      return { ...sd, kayit, periyotAy, gecerlilik };
    });

    // Sadece DB'ye eklenmiş özel dokümanlar (standart listede olmayanlar)
    const ozelDokumanlar = firmaDokumanlari.filter(d =>
      !STANDART_DOKUMANLAR.some(sd => sd.baslik === d.baslik && sd.kategori === d.kategori)
    );

    const satirGuncelle = async (kayitId, data) => {
      await dokumanGuncelle(kayitId, data);
      setDuzenleId(null);
    };

    const satirEkleYaGuncelle = async (sd, durum, tarih, notlar) => {
      if (sd.kayit) {
        await dokumanGuncelle(sd.kayit.id, { durum, tarih: tarih || null, notlar });
      } else {
        await dokumanKaydet(secFirmaId, sd.kategori, sd.baslik, durum, tarih, notlar);
      }
    };

    const SatirDuzenle = ({ sd }) => {
      const [form, setForm] = useState({
        durum: sd.kayit?.durum || "YOK",
        tarih: sd.kayit?.tarih || "",
        notlar: sd.kayit?.notlar || "",
      });
      return (
        <tr style={{ background: "#fffbeb", borderTop: "1px solid #dde3e0" }}>
          <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
            <span style={{ background: "#F4F7F6", borderRadius: 5, padding: "2px 7px" }}>
              {DOKUMAN_KATEGORILER.find(k => k.id === sd.kategori)?.icon} {DOKUMAN_KATEGORILER.find(k => k.id === sd.kategori)?.ad}
            </span>
          </td>
          <td style={{ padding: "8px 12px", color: "#233142", fontSize: 13, fontWeight: 600 }}>{sd.baslik}</td>
          <td style={{ padding: "8px 12px" }}>
            <select value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value }))}
              style={{ padding: "5px 8px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: DURUM_RENKLER[form.durum], fontSize: 13, fontWeight: 700 }}>
              {DURUM_SECENEKLER.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </td>
          <td style={{ padding: "8px 12px" }}>
            {sd.periyotAy ? (
              <input type="date" value={form.tarih} onChange={e => setForm(f => ({ ...f, tarih: e.target.value }))}
                style={{ padding: "5px 8px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: "#454545", fontSize: 13 }} />
            ) : <span style={{ color: "#ADB5BD", fontSize: 12 }}>—</span>}
          </td>
          <td style={{ padding: "8px 12px" }}>
            <input value={form.notlar} onChange={e => setForm(f => ({ ...f, notlar: e.target.value }))} placeholder="Not..."
              style={{ width: "100%", padding: "5px 8px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: "#454545", fontSize: 12 }} />
          </td>
          <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
            <Btn variant="success" style={{ fontSize: 12, padding: "5px 10px", marginRight: 4 }}
              onClick={async () => { await satirEkleYaGuncelle(sd, form.durum, form.tarih, form.notlar); setDuzenleId(null); }}>✓ Kaydet</Btn>
            <Btn variant="secondary" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setDuzenleId(null)}>✕</Btn>
          </td>
        </tr>
      );
    };

    return (
      <div>
        {/* Firma seç + bilgi */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <select value={secFirmaId || ""} onChange={e => setSecFirmaId(Number(e.target.value))}
            style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14, minWidth: 240 }}>
            {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
          {firma && (
            <span style={{ background: "#ecf0f1", borderRadius: 8, padding: "6px 12px", fontSize: 13, color: "#ADB5BD" }}>
              {TEHLIKE[tehlike]?.icon} {tehlike}
            </span>
          )}
          {firma && <Btn onClick={() => setSecFirmaDetay(firma)} variant="secondary" style={{ fontSize: 12, padding: "7px 14px" }}>✏️ Firma Güncelle</Btn>}
          <Btn onClick={() => setYeniFormAc(v => !v)} variant="success" style={{ fontSize: 13, padding: "8px 16px", marginLeft: "auto" }}>
            {yeniFormAc ? "✕ Kapat" : "➕ Özel Doküman Ekle"}
          </Btn>
        </div>

        {/* Özel doküman ekleme formu */}
        {yeniFormAc && (
          <Card style={{ marginBottom: 16 }}>
            <CardHeader title="➕ Özel Doküman Ekle" />
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#ADB5BD", marginBottom: 5 }}>Kategori</label>
                <select value={yeniForm.kategori} onChange={e => setYeniForm(f => ({ ...f, kategori: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 7, color: "#454545", fontSize: 13 }}>
                  {DOKUMAN_KATEGORILER.map(k => <option key={k.id} value={k.id}>{k.icon} {k.ad}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#ADB5BD", marginBottom: 5 }}>Başlık / Açıklama</label>
                <input value={yeniForm.baslik} onChange={e => setYeniForm(f => ({ ...f, baslik: e.target.value }))} placeholder="Doküman adı"
                  style={{ width: "100%", padding: "8px 10px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 7, color: "#454545", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#ADB5BD", marginBottom: 5 }}>Durum</label>
                <select value={yeniForm.durum} onChange={e => setYeniForm(f => ({ ...f, durum: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 7, color: DURUM_RENKLER[yeniForm.durum], fontSize: 13, fontWeight: 700 }}>
                  {DURUM_SECENEKLER.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#ADB5BD", marginBottom: 5 }}>Tarih</label>
                <input type="date" value={yeniForm.tarih} onChange={e => setYeniForm(f => ({ ...f, tarih: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 7, color: "#454545", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ padding: "0 16px 16px", display: "flex", gap: 12 }}>
              <input value={yeniForm.notlar} onChange={e => setYeniForm(f => ({ ...f, notlar: e.target.value }))} placeholder="Notlar (isteğe bağlı)"
                style={{ flex: 1, padding: "8px 10px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 7, color: "#454545", fontSize: 13 }} />
              <Btn onClick={async () => {
                if (!yeniForm.baslik || !secFirmaId) return;
                await dokumanKaydet(secFirmaId, yeniForm.kategori, yeniForm.baslik, yeniForm.durum, yeniForm.tarih, yeniForm.notlar);
                setYeniForm({ kategori: "diger", baslik: "", durum: "VAR", tarih: "", notlar: "" });
                setYeniFormAc(false);
              }} variant="success" disabled={!yeniForm.baslik}>Ekle</Btn>
            </div>
          </Card>
        )}

        {/* Ana doküman tablosu */}
        <Card>
          <CardHeader title={`📋 Doküman Takip — ${firma?.ad || ""}`} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F4F7F6" }}>
                {["Kategori", "Doküman", "Durum", "Tarih / Geçerlilik", "Notlar", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standartSatirlar.map((sd, i) => {
                const kat = DOKUMAN_KATEGORILER.find(k => k.id === sd.kategori);
                if (duzenleId === `std_${i}`) return <SatirDuzenle key={i} sd={sd} />;
                const sonrakiT = sd.kayit?.tarih && sd.periyotAy ? sonrakiTarih(sd.kayit.tarih, sd.periyotAy) : null;
                return (
                  <tr key={i} style={{ borderTop: "1px solid #dde3e0", background: i % 2 === 0 ? "transparent" : "#F4F7F633" }}>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                      <span style={{ background: "#F4F7F6", borderRadius: 5, padding: "2px 7px" }}>{kat?.icon} {kat?.ad}</span>
                    </td>
                    <td style={{ padding: "11px 14px", color: "#233142", fontSize: 13, fontWeight: 600 }}>
                      {sd.baslik}
                      {sd.periyotAy && <span style={{ fontSize: 11, color: "#ADB5BD", marginLeft: 6 }}>({sd.periyotAy} ay)</span>}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {sd.kayit ? (
                        <span style={{ color: DURUM_RENKLER[sd.kayit.durum] || "#9ca3af", fontWeight: 700, fontSize: 13 }}>{sd.kayit.durum}</span>
                      ) : (
                        <span style={{ color: "#f87171", fontWeight: 700, fontSize: 13 }}>YOK</span>
                      )}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {sd.periyotAy && sd.kayit?.tarih ? (
                        <div>
                          <div style={{ fontSize: 12, color: "#ADB5BD" }}>{formatTarih(sd.kayit.tarih)}</div>
                          {sonrakiT && (
                            <span style={{ background: sd.gecerlilik?.bg, color: sd.gecerlilik?.renk, borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>
                              {sd.gecerlilik?.label} · {formatTarih(sonrakiT)}
                            </span>
                          )}
                        </div>
                      ) : sd.kayit?.tarih ? (
                        <span style={{ fontSize: 12, color: "#ADB5BD" }}>{formatTarih(sd.kayit.tarih)}</span>
                      ) : (
                        <span style={{ color: "#ADB5BD", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "11px 14px", color: "#ADB5BD", fontSize: 12 }}>{sd.kayit?.notlar || ""}</td>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                      <Btn variant="secondary" style={{ fontSize: 12, padding: "5px 10px" }}
                        onClick={() => setDuzenleId(`std_${i}`)}>✏️ Güncelle</Btn>
                    </td>
                  </tr>
                );
              })}

              {/* Özel eklenen dokümanlar */}
              {ozelDokumanlar.length > 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "8px 14px", background: "#F4F7F6", fontSize: 11, color: "#ADB5BD", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    📎 Özel Eklenen Dokümanlar
                  </td>
                </tr>
              )}
              {ozelDokumanlar.map((k, i) => {
                const kat = DOKUMAN_KATEGORILER.find(x => x.id === k.kategori);
                if (duzenleId === k.id) return (
                  <tr key={k.id} style={{ background: "#fffbeb", borderTop: "1px solid #dde3e0" }}>
                    <td style={{ padding: "8px 12px" }}>
                      <select value={duzenleForm.kategori || k.kategori} onChange={e => setDuzenleForm(f => ({ ...f, kategori: e.target.value }))}
                        style={{ padding: "5px 8px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: "#454545", fontSize: 12 }}>
                        {DOKUMAN_KATEGORILER.map(dk => <option key={dk.id} value={dk.id}>{dk.icon} {dk.ad}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <input value={duzenleForm.baslik} onChange={e => setDuzenleForm(f => ({ ...f, baslik: e.target.value }))}
                        style={{ width: "100%", padding: "5px 8px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: "#454545", fontSize: 13 }} />
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <select value={duzenleForm.durum} onChange={e => setDuzenleForm(f => ({ ...f, durum: e.target.value }))}
                        style={{ padding: "5px 8px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: DURUM_RENKLER[duzenleForm.durum], fontSize: 13, fontWeight: 700 }}>
                        {DURUM_SECENEKLER.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <input type="date" value={duzenleForm.tarih || ""} onChange={e => setDuzenleForm(f => ({ ...f, tarih: e.target.value }))}
                        style={{ padding: "5px 8px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: "#454545", fontSize: 13 }} />
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <input value={duzenleForm.notlar || ""} onChange={e => setDuzenleForm(f => ({ ...f, notlar: e.target.value }))}
                        style={{ width: "100%", padding: "5px 8px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: "#454545", fontSize: 12 }} />
                    </td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      <Btn variant="success" style={{ fontSize: 12, padding: "5px 10px", marginRight: 4 }} onClick={() => satirGuncelle(k.id, duzenleForm)}>✓</Btn>
                      <Btn variant="secondary" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setDuzenleId(null)}>✕</Btn>
                    </td>
                  </tr>
                );
                return (
                  <tr key={k.id} style={{ borderTop: "1px solid #dde3e0", background: i % 2 === 0 ? "#fafafa" : "transparent" }}>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                      <span style={{ background: "#F4F7F6", borderRadius: 5, padding: "2px 7px" }}>{kat?.icon} {kat?.ad}</span>
                    </td>
                    <td style={{ padding: "11px 14px", color: "#454545", fontSize: 13, fontWeight: 500 }}>{k.baslik}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ color: DURUM_RENKLER[k.durum] || "#9ca3af", fontWeight: 700, fontSize: 13 }}>{k.durum}</span>
                    </td>
                    <td style={{ padding: "11px 14px", color: "#ADB5BD", fontSize: 13 }}>{formatTarih(k.tarih)}</td>
                    <td style={{ padding: "11px 14px", color: "#ADB5BD", fontSize: 12 }}>{k.notlar}</td>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                      <Btn variant="secondary" style={{ fontSize: 12, padding: "5px 10px", marginRight: 4 }}
                        onClick={() => { setDuzenleId(k.id); setDuzenleForm({ kategori: k.kategori, baslik: k.baslik, durum: k.durum, tarih: k.tarih || "", notlar: k.notlar || "" }); }}>✏️</Btn>
                      <Btn variant="danger" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => dokumanSil(k.id)}>Sil</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  const EgitimTakipSayfa = () => {
    const [secFirmaId, setSecFirmaId] = useState(firmalar[0]?.id || null);
    const [egitimTuru, setEgitimTuru] = useState(() => egitimTurleri[0]?.id || "");
    const [topluMetin, setTopluMetin] = useState("");
    const [topluSonuc, setTopluSonuc] = useState(null);
    const [tekForm, setTekForm] = useState({ tc: "", tarih1: "", tarih2: "" });
    const [mod, setMod] = useState("liste");
    const [yukleniyor2, setYukleniyor2] = useState(false);

    const firma = firmalar.find(f => f.id === secFirmaId);
    const tehlike = TEHLIKE[firma?.tehlike_sinifi];
    const firmaPersonel = aktifPersonel.filter(p => p.firma_id === secFirmaId);

    // Kişinin bu eğitim türündeki tüm kayıtları - egitim_no'ya göre
    const kisiEgitimler = (personelId) => {
      // egitim_turu hem string "isg" hem de numeric id olabilir - ikisini de kontrol et
      const kayitlar = egitimler.filter(e => {
        if (e.personel_id !== personelId) return false;
        // String eşleşmesi (eski format) veya ID eşleşmesi (yeni format)
        return String(e.egitim_turu) === String(egitimTuru);
      }).sort((a, b) => new Date(a.egitim_tarihi) - new Date(b.egitim_tarihi));

      // egitim_no alanı varsa ona bak, yoksa sıraya göre ata
      const e1 = kayitlar.find(k => k.egitim_no === 1) || kayitlar.find(k => !k.egitim_no) || kayitlar[0] || null;
      const e2 = kayitlar.find(k => k.egitim_no === 2) || (kayitlar.length > 1 ? kayitlar.find(k => k !== e1) : null);
      return { egitim1: e1, egitim2: e2 };
    };

    // Toplam saat hesapla - tehlike sınıfına göre
    const toplamSaatHesapla = (e1, e2) => {
      const t = tehlike;
      if (!t) return { toplam: 0, hedef: 0 };
      const saat1 = e1 ? t.egitim1Saat : 0;
      const saat2 = e2 ? t.egitim2Saat : 0;
      return { toplam: saat1 + saat2, hedef: t.toplamSaat };
    };

    // Son eğitim tarihi (en yeni)
    const sonTarih = (e1, e2) => {
      const tarihler = [e1?.egitim_tarihi, e2?.egitim_tarihi].filter(Boolean);
      if (!tarihler.length) return null;
      return tarihler.sort((a, b) => new Date(b) - new Date(a))[0];
    };

    const egitimListesi = firmaPersonel.map(p => {
      const { egitim1, egitim2 } = kisiEgitimler(p.id);
      const saatler = toplamSaatHesapla(egitim1, egitim2);
      const periyot = egitimTurleri.find(e => String(e.id) === String(egitimTuru))?.periyotFn(firma?.tehlike_sinifi);
      // Eğer 2. eğitim gerekli (tehlike2Saat > 0) ama yapılmamışsa → Eğitim Eksik
      const ikincEgitimGerekli = tehlike?.egitim2Saat > 0;
      const egitimTamamlandi = ikincEgitimGerekli ? (egitim1 && egitim2) : !!egitim1;
      // Geçerlilik tarihi: eğitim tamamlandıysa en son eğitim tarihinden itibaren sayılır
      const gecerlilikBaslangic = egitimTamamlandi ? sonTarih(egitim1, egitim2) : null;
      const d = durumHesapla(gecerlilikBaslangic, periyot, "Eğitim Eksik");
      return { ...p, egitim1, egitim2, saatler, d };
    }).sort((a, b) => b.d.onc - a.d.onc);

    // Tek kişi kaydet
    const tekKaydet = async () => {
      if (!tekForm.tc || (!tekForm.tarih1 && !tekForm.tarih2)) return;
      const p = firmaPersonel.find(x => x.tc_no === tekForm.tc);
      if (!p) { alert("Bu TC No firmada bulunamadı!"); return; }
      setYukleniyor2(true);
      const turStr = String(egitimTuru);
      if (tekForm.tarih1) {
        const mevcut1 = egitimler.find(e => e.personel_id === p.id && String(e.egitim_turu) === turStr && e.egitim_no === 1);
        if (mevcut1) await supabase.from("egitimler").update({ egitim_tarihi: tekForm.tarih1 }).eq("id", mevcut1.id);
        else await supabase.from("egitimler").insert({ personel_id: p.id, egitim_turu: turStr, egitim_tarihi: tekForm.tarih1, egitim_no: 1 });
      }
      if (tekForm.tarih2 && tehlike?.egitim2Saat > 0) {
        const mevcut2 = egitimler.find(e => e.personel_id === p.id && String(e.egitim_turu) === turStr && e.egitim_no === 2);
        if (mevcut2) await supabase.from("egitimler").update({ egitim_tarihi: tekForm.tarih2 }).eq("id", mevcut2.id);
        else await supabase.from("egitimler").insert({ personel_id: p.id, egitim_turu: turStr, egitim_tarihi: tekForm.tarih2, egitim_no: 2 });
      }
      await veriYukle();
      setTekForm({ tc: "", tarih1: "", tarih2: "" });
      setYukleniyor2(false);
    };

    // Tarih parse yardımcısı
    const parseTarih = (t) => {
      if (!t) return null;
      t = t.trim();
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(t)) { const [g,a,y] = t.split("."); return `${y}-${a}-${g}`; }
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
      return null;
    };

    // Excel yapıştırma parse: Firma | Ad Soyad | Görev | TCKN | Eğitim1 | Eğitim2
    // Aynı TC için birden fazla satır olabilir — tüm tarihleri toplar
    const topluKarsilastir = () => {
      const satirlar = topluMetin.trim().split("\n").map(s => s.trim()).filter(Boolean);
      const tcHavuzu = {}; // tc → { p, tarihler: [] }
      const hatali = [];

      satirlar.forEach(satir => {
        const parcalar = satir.split(/\t/);
        // Firma(0) AdSoyad(1) Görev(2) TCKN(3) Eğitim1(4) Eğitim2(5)
        // veya sadece TCKN(0) Eğitim1(1) Eğitim2(2) formatı da destekle
        let tc, t1, t2;
        if (parcalar.length >= 4) {
          // Excel tam format
          tc = parcalar[3]?.trim();
          t1 = parseTarih(parcalar[4]);
          t2 = parseTarih(parcalar[5]);
        } else {
          // Kısa format: TC Tarih1 Tarih2
          tc = parcalar[0]?.trim();
          t1 = parseTarih(parcalar[1]);
          t2 = parseTarih(parcalar[2]);
        }

        const p = firmaPersonel.find(x => x.tc_no === tc);
        if (!p) { hatali.push({ satir, sebep: "TC firmada bulunamadı" }); return; }
        if (!t1 && !t2) { hatali.push({ satir, sebep: "Tarih bulunamadı" }); return; }

        if (!tcHavuzu[tc]) tcHavuzu[tc] = { p, tarihler: [] };
        if (t1) tcHavuzu[tc].tarihler.push(t1);
        if (t2 && t2 !== t1) tcHavuzu[tc].tarihler.push(t2);
      });

      // Her TC için tarihleri sırala, Eğitim1=en erken, Eğitim2=sonraki (eğer hedef 2 eğitimse)
      const basarili = Object.values(tcHavuzu).map(({ p, tarihler }) => {
        const benzersiz = [...new Set(tarihler)].sort((a, b) => new Date(a) - new Date(b));
        const tarih1 = benzersiz[0] || null;
        // Eğitim2: sadece çok tehlikeli/tehlikeli için gerekli
        const tarih2 = (tehlike?.egitim2Saat > 0 && benzersiz.length > 1) ? benzersiz[1] : null;
        // Geçerlilik: iki eğitim gerekliyse her ikisi de varsa en erken tarihten, tek eğitimse o tarihten
        const gecerlilikBas = tarih1;
        const periyot = egitimTurleri.find(e => e.id === egitimTuru)?.periyotFn(firma?.tehlike_sinifi);
        const gecerlilikBitis = gecerlilikBas && periyot ? sonrakiTarih(gecerlilikBas, periyot) : null;
        const tamamlandi = tehlike?.egitim2Saat > 0 ? (tarih1 && tarih2) : !!tarih1;
        return { p, tarih1, tarih2, benzersizSayisi: benzersiz.length, gecerlilikBitis, tamamlandi };
      });

      setTopluSonuc({ basarili, hatali });
    };

    const topluOnayla = async () => {
      if (!topluSonuc) return;
      setYukleniyor2(true);
      const turStr = String(egitimTuru);
      for (const kayit of topluSonuc.basarili) {
        if (kayit.tarih1) {
          const mevcut1 = egitimler.find(e => e.personel_id === kayit.p.id && String(e.egitim_turu) === turStr && e.egitim_no === 1);
          if (mevcut1) await supabase.from("egitimler").update({ egitim_tarihi: kayit.tarih1 }).eq("id", mevcut1.id);
          else await supabase.from("egitimler").insert({ personel_id: kayit.p.id, egitim_turu: turStr, egitim_tarihi: kayit.tarih1, egitim_no: 1 });
        }
        if (kayit.tarih2 && tehlike?.egitim2Saat > 0) {
          const mevcut2 = egitimler.find(e => e.personel_id === kayit.p.id && String(e.egitim_turu) === turStr && e.egitim_no === 2);
          if (mevcut2) await supabase.from("egitimler").update({ egitim_tarihi: kayit.tarih2 }).eq("id", mevcut2.id);
          else await supabase.from("egitimler").insert({ personel_id: kayit.p.id, egitim_turu: turStr, egitim_tarihi: kayit.tarih2, egitim_no: 2 });
        }
      }
      await veriYukle();
      setTopluSonuc(null);
      setTopluMetin("");
      setYukleniyor2(false);
      alert(`✅ ${topluSonuc.basarili.length} kişi güncellendi!`);
    };

    const egitimAdi = egitimTurleri.find(e => e.id === egitimTuru)?.ad || "";
    const egitimIcon = egitimTurleri.find(e => e.id === egitimTuru)?.icon || "";

    return (
      <div>
        {/* Üst kontroller */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <select value={secFirmaId || ""} onChange={e => setSecFirmaId(Number(e.target.value))}
            style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14, minWidth: 220 }}>
            {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
          <select value={String(egitimTuru)} onChange={e => setEgitimTuru(e.target.value)}
            style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14 }}>
            {egitimTurleri.map(e => <option key={e.id} value={String(e.id)}>{e.icon} {e.ad}</option>)}
          </select>
          {/* Saat bilgi kartı */}
          {tehlike && (
            <div style={{ background: "#ffffff", border: `1px solid ${tehlike.renk}33`, borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#ADB5BD", display: "flex", gap: 16 }}>
              <span>{tehlike.icon} {firma?.tehlike_sinifi}</span>
              <span>Eğitim 1: <strong style={{ color: "#233142" }}>{tehlike.egitim1Saat} saat</strong></span>
              {tehlike.egitim2Saat > 0 && <span>Eğitim 2: <strong style={{ color: "#233142" }}>{tehlike.egitim2Saat} saat</strong></span>}
              <span>Toplam hedef: <strong style={{ color: "#27ae60" }}>{tehlike.toplamSaat} saat</strong></span>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {[["liste","📋 Liste"],["tek","➕ Tek Kayıt"],["toplu","📤 Toplu Yükle"]].map(([id, label]) => (
              <button key={id} onClick={() => setMod(id)} style={{
                padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: mod === id ? "#1d4ed8" : "#111827", color: mod === id ? "#fff" : "#6b7280"
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* LİSTE MODU */}
        {mod === "liste" && (
          <Card>
            <CardHeader title={`${egitimIcon} ${firma?.ad || ""} — ${egitimAdi} (${egitimListesi.length} personel)`} />
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F4F7F6" }}>
                  {["Ad Soyad", "Görev", "TC No", "Eğitim 1", "Eğitim 2", "Toplam Saat", "Durum", ""].map(h => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {egitimListesi.map((p, i) => {
                  const { toplam, hedef } = p.saatler;
                  const tamamlandi = toplam >= hedef;
                  return (
                    <tr key={p.id} style={{ borderTop: "1px solid #dde3e0" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "#233142" }}>{p.ad_soyad}</td>
                      <td style={{ padding: "12px 14px", color: "#ADB5BD", fontSize: 13 }}>{p.gorev}</td>
                      <td style={{ padding: "12px 14px", color: "#ADB5BD", fontSize: 12, fontFamily: "monospace" }}>{p.tc_no}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>
                        {p.egitim1 ? <span style={{ color: "#27ae60" }}>{formatTarih(p.egitim1.egitim_tarihi)}</span> : <span style={{ color: "#ADB5BD" }}>—</span>}
                        {p.egitim1 && tehlike && <span style={{ color: "#ADB5BD", fontSize: 11, marginLeft: 4 }}>({tehlike.egitim1Saat}s)</span>}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>
                        {tehlike?.egitim2Saat > 0
                          ? p.egitim2
                            ? <span style={{ color: "#27ae60" }}>{formatTarih(p.egitim2.egitim_tarihi)}<span style={{ color: "#ADB5BD", fontSize: 11, marginLeft: 4 }}>({tehlike.egitim2Saat}s)</span></span>
                            : <span style={{ color: "#e74c3c" }}>Eksik</span>
                          : <span style={{ color: "#ADB5BD", fontSize: 12 }}>Gerekmiyor</span>
                        }
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: tamamlandi ? "#4ade80" : "#fbbf24" }}>
                          {tamamlandi ? "✅" : "⚠️"} {toplam}/{hedef} saat
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}><Badge d={p.d} /></td>
                      <td style={{ padding: "12px 14px" }}>
                        <Btn variant="secondary" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => {
                          setTekForm({ tc: p.tc_no, tarih1: p.egitim1?.egitim_tarihi || "", tarih2: p.egitim2?.egitim_tarihi || "" });
                          setMod("tek");
                        }}>Güncelle</Btn>
                      </td>
                    </tr>
                  );
                })}
                {egitimListesi.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#ADB5BD" }}>Bu firmada aktif personel yok.</td></tr>}
              </tbody>
            </table>
          </Card>
        )}

        {/* TEK KAYIT MODU */}
        {mod === "tek" && (
          <Card>
            <CardHeader title={`➕ Tek Kayıt — ${egitimAdi}`} />
            <div style={{ padding: 20 }}>
              {/* Personel seç */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, color: "#ADB5BD", marginBottom: 6 }}>Personel Seç</label>
                <select value={tekForm.tc} onChange={e => {
                  const p = firmaPersonel.find(x => x.tc_no === e.target.value);
                  if (p) {
                    const { egitim1, egitim2 } = kisiEgitimler(p.id);
                    setTekForm({ tc: e.target.value, tarih1: egitim1?.egitim_tarihi || "", tarih2: egitim2?.egitim_tarihi || "" });
                  } else setTekForm({ tc: e.target.value, tarih1: "", tarih2: "" });
                }}
                  style={{ width: "100%", padding: "9px 12px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 13 }}>
                  <option value="">-- Personel Seçin --</option>
                  {firmaPersonel.map(p => <option key={p.id} value={p.tc_no}>{p.ad_soyad} — {p.tc_no}</option>)}
                </select>
              </div>
              {/* Eğitim tarihleri */}
              <div style={{ display: "grid", gridTemplateColumns: tehlike?.egitim2Saat > 0 ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 16 }}>
                <div style={{ background: "#F4F7F6", borderRadius: 8, padding: 14, border: "1px solid #1e293b" }}>
                  <div style={{ fontWeight: 700, color: "#233142", marginBottom: 10, fontSize: 13 }}>
                    📅 Eğitim 1 — <span style={{ color: "#27ae60" }}>{tehlike?.egitim1Saat || 8} saat</span>
                  </div>
                  <input type="date" value={tekForm.tarih1} onChange={e => setTekForm(f => ({ ...f, tarih1: e.target.value }))}
                    style={{ width: "100%", padding: "9px 12px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                {tehlike?.egitim2Saat > 0 && (
                  <div style={{ background: "#F4F7F6", borderRadius: 8, padding: 14, border: "1px solid #1e293b" }}>
                    <div style={{ fontWeight: 700, color: "#233142", marginBottom: 10, fontSize: 13 }}>
                      📅 Eğitim 2 — <span style={{ color: "#27ae60" }}>{tehlike.egitim2Saat} saat</span>
                    </div>
                    <input type="date" value={tekForm.tarih2} onChange={e => setTekForm(f => ({ ...f, tarih2: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                )}
              </div>
              {tehlike && (
                <div style={{ background: "#ffffff", borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 13, color: "#ADB5BD" }}>
                  {tehlike.icon} <strong style={{ color: "#454545" }}>{firma?.tehlike_sinifi}</strong> — Hedef toplam:
                  <strong style={{ color: "#27ae60", marginLeft: 6 }}>{tehlike.toplamSaat} saat</strong>
                  {" "}({tehlike.egitim1Saat}s + {tehlike.egitim2Saat}s)
                </div>
              )}
              <Btn onClick={tekKaydet} disabled={!tekForm.tc || !tekForm.tarih1 || yukleniyor2} variant="success" style={{ minWidth: 160 }}>
                {yukleniyor2 ? "Kaydediliyor..." : "✅ Kaydet"}
              </Btn>
            </div>
          </Card>
        )}

        {/* TOPLU YÜKLEME */}
        {mod === "toplu" && (
          <Card>
            <CardHeader title={`📤 Toplu Yükleme — ${egitimAdi}`} />
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: "#ADB5BD", marginBottom: 8, background: "#F4F7F6", borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700, color: "#454545", marginBottom: 8 }}>📋 Excel'den doğrudan yapıştırın — iki format desteklenir:</div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: "#233142" }}>Tam format:</span> <span style={{ fontFamily: "monospace", color: "#27ae60" }}>Firma [TAB] Ad Soyad [TAB] Görev [TAB] TCKN [TAB] Eğitim1 [TAB] Eğitim2</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: "#233142" }}>Kısa format:</span> <span style={{ fontFamily: "monospace", color: "#27ae60" }}>TCKN [TAB] Eğitim1 Tarihi [TAB] Eğitim2 Tarihi</span>
                </div>
                <div style={{ color: "#d97706" }}>
                  ⚠️ Aynı kişinin birden fazla satırı varsa sistem otomatik birleştirir —
                  en erken tarih → Eğitim 1, sonraki → Eğitim 2.<br/>
                  {tehlike && `📐 ${firma?.tehlike_sinifi}: Eğitim1=${tehlike.egitim1Saat}s${tehlike.egitim2Saat > 0 ? `, Eğitim2=${tehlike.egitim2Saat}s` : " (tek eğitim yeterli)"} → Hedef=${tehlike.toplamSaat}s`}
                </div>
              </div>
              <textarea value={topluMetin} onChange={e => { setTopluMetin(e.target.value); setTopluSonuc(null); }} rows={10}
                placeholder={"Excel'den kopyala-yapıştır:\nSODEXO DIŞ CEPHE\tOnur Şensoy\tCamcı\t57607355682\t28.01.2025\t28.01.2025\nSODEXO DIŞ CEPHE\tZeki Senok\tCamcı\t32438095778\t21.01.2025\t21.01.2025"}
                style={{ width: "100%", padding: "10px 14px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 12, resize: "vertical", boxSizing: "border-box", fontFamily: "monospace", marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 10 }}>
                <Btn onClick={topluKarsilastir} disabled={!topluMetin.trim()} variant="secondary">🔍 Analiz Et</Btn>
                {topluSonuc && <Btn onClick={topluOnayla} variant="success" disabled={!topluSonuc.basarili.length || yukleniyor2}>
                  {yukleniyor2 ? "Kaydediliyor..." : `✅ ${topluSonuc.basarili.length} Kişiyi Kaydet`}
                </Btn>}
                {topluSonuc && <Btn onClick={() => { setTopluSonuc(null); }} variant="danger">İptal</Btn>}
              </div>

              {topluSonuc && (
                <div style={{ marginTop: 20 }}>
                  {topluSonuc.basarili.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, color: "#27ae60", marginBottom: 10, fontSize: 14 }}>
                        ✅ Kaydedilecek — {topluSonuc.basarili.length} kişi
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr style={{ background: "#F4F7F6" }}>
                          {["Ad Soyad", "TC No", "Eğitim 1", "Eğitim 2", "Toplam Saat", "Geçerlilik Bitiş"].map(h =>
                            <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {topluSonuc.basarili.map((k, i) => {
                            const saat1 = k.tarih1 ? (tehlike?.egitim1Saat || 0) : 0;
                            const saat2 = k.tarih2 ? (tehlike?.egitim2Saat || 0) : 0;
                            const toplam = saat1 + saat2;
                            const hedef = tehlike?.toplamSaat || 0;
                            return (
                              <tr key={i} style={{ borderTop: "1px solid #dde3e0" }}>
                                <td style={{ padding: "10px 12px", fontWeight: 600, color: "#233142", fontSize: 13 }}>{k.p.ad_soyad}</td>
                                <td style={{ padding: "10px 12px", color: "#ADB5BD", fontSize: 12, fontFamily: "monospace" }}>{k.p.tc_no}</td>
                                <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                  {k.tarih1 ? <span style={{ color: "#27ae60" }}>{formatTarih(k.tarih1)} <span style={{ color: "#ADB5BD", fontSize: 11 }}>({tehlike?.egitim1Saat}s)</span></span> : <span style={{ color: "#ADB5BD" }}>—</span>}
                                </td>
                                <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                  {tehlike?.egitim2Saat > 0
                                    ? k.tarih2
                                      ? <span style={{ color: "#27ae60" }}>{formatTarih(k.tarih2)} <span style={{ color: "#ADB5BD", fontSize: 11 }}>({tehlike.egitim2Saat}s)</span></span>
                                      : <span style={{ color: "#e74c3c", fontSize: 12 }}>Eksik</span>
                                    : <span style={{ color: "#ADB5BD", fontSize: 12 }}>—</span>}
                                </td>
                                <td style={{ padding: "10px 12px" }}>
                                  <span style={{ fontWeight: 700, color: toplam >= hedef ? "#4ade80" : "#fbbf24" }}>
                                    {toplam >= hedef ? "✅" : "⚠️"} {toplam}/{hedef}s
                                  </span>
                                </td>
                                <td style={{ padding: "10px 12px", color: k.tamamlandi ? "#60a5fa" : "#4b5563", fontSize: 13 }}>
                                  {k.gecerlilikBitis ? formatTarih(k.gecerlilikBitis) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {topluSonuc.hatali.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, color: "#e74c3c", marginBottom: 8 }}>❌ Eşleştirilemeyen satırlar ({topluSonuc.hatali.length})</div>
                      {topluSonuc.hatali.map((h, i) => (
                        <div key={i} style={{ background: "#fdedec", borderRadius: 6, padding: "7px 12px", marginBottom: 4, fontSize: 12, color: "#e74c3c" }}>
                          <span style={{ fontFamily: "monospace" }}>{h.satir.substring(0, 80)}{h.satir.length > 80 ? "..." : ""}</span>
                          <span style={{ color: "#e74c3c", marginLeft: 8 }}>→ {h.sebep}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    );
  };


  const MuayeneTakipSayfa = () => {
    const [secFirmaId, setSecFirmaId] = useState(firmalar[0]?.id || null);
    const [muayeneTuru, setMuayeneTuru] = useState("periyodik");
    const [topluMetin, setTopluMetin] = useState("");
    const [topluSonuc, setTopluSonuc] = useState(null);
    const [tekForm, setTekForm] = useState({ tc: "", tarih: "" });
    const [mod, setMod] = useState("liste");
    const [yukleniyor2, setYukleniyor2] = useState(false);

    const firma = firmalar.find(f => f.id === secFirmaId);
    const tehlike = TEHLIKE[firma?.tehlike_sinifi];
    const firmaPersonel = aktifPersonel.filter(p => p.firma_id === secFirmaId);
    const seciliTur = MUAYENE_TURLERI.find(m => m.id === muayeneTuru);
    const periyot = seciliTur?.periyotFn(firma?.tehlike_sinifi);

    // Kişinin son muayene kaydı
    const kisiSonMuayene = (personelId) => {
      const kayitlar = muayeneler.filter(m => m.personel_id === personelId && m.muayene_turu === muayeneTuru)
        .sort((a, b) => new Date(b.muayene_tarihi) - new Date(a.muayene_tarihi));
      return kayitlar[0] || null;
    };

    const muayeneListesi = firmaPersonel.map(p => {
      const son = kisiSonMuayene(p.id);
      const d = durumHesapla(son?.muayene_tarihi || null, periyot, "Muayene Eksik");
      return { ...p, son, d };
    }).sort((a, b) => b.d.onc - a.d.onc);

    // Tek kişi kaydet
    const tekKaydet = async () => {
      if (!tekForm.tc || !tekForm.tarih) return;
      const p = firmaPersonel.find(x => x.tc_no === tekForm.tc);
      if (!p) { alert("Bu TC No firmada bulunamadı!"); return; }
      setYukleniyor2(true);
      await supabase.from("muayeneler").insert({ personel_id: p.id, muayene_turu: muayeneTuru, muayene_tarihi: tekForm.tarih });
      await veriYukle();
      setTekForm({ tc: "", tarih: "" });
      setYukleniyor2(false);
    };

    const parseTarih = (t) => {
      if (!t) return null;
      t = t.trim();
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(t)) { const [g,a,y] = t.split("."); return `${y}-${a}-${g}`; }
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
      return null;
    };

    // Toplu parse — Excel format: Firma | Ad Soyad | Görev | TCKN | Muayene Tarihi
    const topluKarsilastir = () => {
      const satirlar = topluMetin.trim().split("\n").map(s => s.trim()).filter(Boolean);
      const basarili = [], hatali = [];
      satirlar.forEach(satir => {
        const parcalar = satir.split(/\t/);
        let tc, tarih;
        if (parcalar.length >= 4) {
          tc = parcalar[3]?.trim();
          tarih = parseTarih(parcalar[4]);
        } else {
          tc = parcalar[0]?.trim();
          tarih = parseTarih(parcalar[1]);
        }
        const p = firmaPersonel.find(x => x.tc_no === tc);
        if (!p) { hatali.push({ satir, sebep: "TC firmada bulunamadı" }); return; }
        if (!tarih) { hatali.push({ satir, sebep: "Tarih bulunamadı" }); return; }
        // Aynı TC için en son tarihi al
        const mevcut = basarili.find(b => b.p.tc_no === tc);
        if (mevcut) {
          if (new Date(tarih) > new Date(mevcut.tarih)) mevcut.tarih = tarih;
        } else {
          basarili.push({ p, tarih });
        }
      });
      setTopluSonuc({ basarili, hatali });
    };

    const topluOnayla = async () => {
      if (!topluSonuc) return;
      setYukleniyor2(true);
      for (const kayit of topluSonuc.basarili) {
        await supabase.from("muayeneler").insert({ personel_id: kayit.p.id, muayene_turu: muayeneTuru, muayene_tarihi: kayit.tarih });
      }
      await veriYukle();
      setTopluSonuc(null);
      setTopluMetin("");
      setYukleniyor2(false);
      alert(`✅ ${topluSonuc.basarili.length} muayene kaydı eklendi!`);
    };

    return (
      <div>
        {/* Üst kontroller */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <select value={secFirmaId || ""} onChange={e => { setSecFirmaId(Number(e.target.value)); setTopluSonuc(null); }}
            style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14, minWidth: 220 }}>
            {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
          <select value={muayeneTuru} onChange={e => { setMuayeneTuru(e.target.value); setTopluSonuc(null); }}
            style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14 }}>
            {MUAYENE_TURLERI.map(m => <option key={m.id} value={m.id}>{m.icon} {m.ad}</option>)}
          </select>
          {tehlike && periyot && (
            <div style={{ background: "#ffffff", border: `1px solid ${tehlike.renk}33`, borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#ADB5BD", display: "flex", gap: 12 }}>
              <span>{tehlike.icon} {firma?.tehlike_sinifi}</span>
              <span>Periyot: <strong style={{ color: "#233142" }}>{periyot} ayda bir</strong></span>
            </div>
          )}
          {!periyot && muayeneTuru === "ise_giris" && (
            <div style={{ background: "#ffffff", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#ADB5BD" }}>
              📋 İşe giriş muayenesi tek seferlik
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {[["liste","📋 Liste"],["tek","➕ Tek Kayıt"],["toplu","📤 Toplu Yükle"]].map(([id, label]) => (
              <button key={id} onClick={() => setMod(id)} style={{
                padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: mod === id ? "#1d4ed8" : "#111827", color: mod === id ? "#fff" : "#6b7280"
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* LİSTE MODU */}
        {mod === "liste" && (
          <Card>
            <CardHeader title={`🩺 ${firma?.ad || ""} — ${seciliTur?.ad} (${muayeneListesi.length} personel)`} />
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F4F7F6" }}>
                  {["Ad Soyad", "Görev", "TC No", "Son Muayene", "Sonraki", "Durum", ""].map(h => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {muayeneListesi.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid #dde3e0" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "#233142" }}>{p.ad_soyad}</td>
                    <td style={{ padding: "12px 14px", color: "#ADB5BD", fontSize: 13 }}>{p.gorev}</td>
                    <td style={{ padding: "12px 14px", color: "#ADB5BD", fontSize: 12, fontFamily: "monospace" }}>{p.tc_no}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: p.son ? "#4ade80" : "#4b5563" }}>
                      {p.son ? formatTarih(p.son.muayene_tarihi) : "—"}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "#ADB5BD" }}>
                      {periyot && p.son ? formatTarih(sonrakiTarih(p.son.muayene_tarihi, periyot)) : "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}><Badge d={p.d} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      <Btn variant="secondary" style={{ fontSize: 12, padding: "5px 10px" }}
                        onClick={() => { setTekForm({ tc: p.tc_no, tarih: p.son?.muayene_tarihi || "" }); setMod("tek"); }}>
                        Güncelle
                      </Btn>
                    </td>
                  </tr>
                ))}
                {muayeneListesi.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#ADB5BD" }}>Bu firmada aktif personel yok.</td></tr>}
              </tbody>
            </table>
          </Card>
        )}

        {/* TEK KAYIT MODU */}
        {mod === "tek" && (
          <Card>
            <CardHeader title={`➕ Tek Kayıt — ${seciliTur?.ad}`} />
            <div style={{ padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#ADB5BD", marginBottom: 6 }}>Personel Seç</label>
                  <select value={tekForm.tc} onChange={e => {
                    const p = firmaPersonel.find(x => x.tc_no === e.target.value);
                    const son = p ? kisiSonMuayene(p.id) : null;
                    setTekForm({ tc: e.target.value, tarih: son?.muayene_tarihi || "" });
                  }}
                    style={{ width: "100%", padding: "9px 12px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 13 }}>
                    <option value="">-- Personel Seçin --</option>
                    {firmaPersonel.map(p => <option key={p.id} value={p.tc_no}>{p.ad_soyad} — {p.tc_no}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#ADB5BD", marginBottom: 6 }}>Muayene Tarihi</label>
                  <input type="date" value={tekForm.tarih} onChange={e => setTekForm(f => ({ ...f, tarih: e.target.value }))}
                    style={{ width: "100%", padding: "9px 12px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 13, boxSizing: "border-box" }} />
                </div>
              </div>
              {tekForm.tc && periyot && tekForm.tarih && (
                <div style={{ background: "#ffffff", borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 13, color: "#ADB5BD" }}>
                  📅 Sonraki muayene: <strong style={{ color: "#233142" }}>{formatTarih(sonrakiTarih(tekForm.tarih, periyot))}</strong>
                </div>
              )}
              <Btn onClick={tekKaydet} disabled={!tekForm.tc || !tekForm.tarih || yukleniyor2} variant="success" style={{ minWidth: 160 }}>
                {yukleniyor2 ? "Kaydediliyor..." : "✅ Muayene Kaydet"}
              </Btn>
            </div>
          </Card>
        )}

        {/* TOPLU YÜKLEME */}
        {mod === "toplu" && (
          <Card>
            <CardHeader title={`📤 Toplu Yükleme — ${seciliTur?.ad}`} />
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: "#ADB5BD", marginBottom: 8, background: "#F4F7F6", borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700, color: "#454545", marginBottom: 8 }}>📋 Excel'den doğrudan yapıştırın — iki format desteklenir:</div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: "#233142" }}>Tam format:</span> <span style={{ fontFamily: "monospace", color: "#27ae60" }}>Firma [TAB] Ad Soyad [TAB] Görev [TAB] TCKN [TAB] Muayene Tarihi</span>
                </div>
                <div>
                  <span style={{ color: "#233142" }}>Kısa format:</span> <span style={{ fontFamily: "monospace", color: "#27ae60" }}>TCKN [TAB] Muayene Tarihi</span>
                </div>
                {periyot && <div style={{ color: "#d97706", marginTop: 6 }}>⚠️ Aynı kişinin birden fazla satırı varsa en son tarih alınır. Periyot: {periyot} ay.</div>}
              </div>
              <textarea value={topluMetin} onChange={e => { setTopluMetin(e.target.value); setTopluSonuc(null); }} rows={8}
                placeholder={"Excel'den kopyala-yapıştır:\nSODEXO DIŞ CEPHE\tOnur Şensoy\tCamcı\t57607355682\t28.01.2025"}
                style={{ width: "100%", padding: "10px 14px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 12, resize: "vertical", boxSizing: "border-box", fontFamily: "monospace", marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 10 }}>
                <Btn onClick={topluKarsilastir} disabled={!topluMetin.trim()} variant="secondary">🔍 Analiz Et</Btn>
                {topluSonuc && <Btn onClick={topluOnayla} variant="success" disabled={!topluSonuc.basarili.length || yukleniyor2}>
                  {yukleniyor2 ? "Kaydediliyor..." : `✅ ${topluSonuc.basarili.length} Kaydı Ekle`}
                </Btn>}
                {topluSonuc && <Btn onClick={() => setTopluSonuc(null)} variant="danger">İptal</Btn>}
              </div>
              {topluSonuc && (
                <div style={{ marginTop: 20 }}>
                  {topluSonuc.basarili.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, color: "#27ae60", marginBottom: 10 }}>✅ Eklenecek — {topluSonuc.basarili.length} kişi</div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr style={{ background: "#F4F7F6" }}>
                          {["Ad Soyad", "TC No", "Muayene Tarihi", "Sonraki Muayene"].map(h =>
                            <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {topluSonuc.basarili.map((k, i) => (
                            <tr key={i} style={{ borderTop: "1px solid #dde3e0" }}>
                              <td style={{ padding: "10px 12px", fontWeight: 600, color: "#233142", fontSize: 13 }}>{k.p.ad_soyad}</td>
                              <td style={{ padding: "10px 12px", color: "#ADB5BD", fontSize: 12, fontFamily: "monospace" }}>{k.p.tc_no}</td>
                              <td style={{ padding: "10px 12px", color: "#27ae60", fontSize: 13 }}>{formatTarih(k.tarih)}</td>
                              <td style={{ padding: "10px 12px", color: periyot ? "#60a5fa" : "#4b5563", fontSize: 13 }}>
                                {periyot ? formatTarih(sonrakiTarih(k.tarih, periyot)) : "Tek seferlik"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {topluSonuc.hatali.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, color: "#e74c3c", marginBottom: 8 }}>❌ Eşleştirilemeyen ({topluSonuc.hatali.length})</div>
                      {topluSonuc.hatali.map((h, i) => (
                        <div key={i} style={{ background: "#fdedec", borderRadius: 6, padding: "7px 12px", marginBottom: 4, fontSize: 12, color: "#e74c3c" }}>
                          <span style={{ fontFamily: "monospace" }}>{h.satir.substring(0, 80)}{h.satir.length > 80 ? "..." : ""}</span>
                          <span style={{ color: "#e74c3c", marginLeft: 8 }}>→ {h.sebep}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    );
  };

  const RaporSayfa = () => {
    const [secFirmaId, setSecFirmaId] = useState(firmalar[0]?.id || null);
    const [aktifRapor, setAktifRapor] = useState("egitim");
    const firma = firmalar.find(f => f.id === secFirmaId);
    const firmaPersonel = aktifPersonel.filter(p => p.firma_id === secFirmaId);

    const isgTurRapor = egitimTurleri[0]; // Sadece İSG Temel Eğitimi
    const egitimEksik = isgTurRapor ? firmaPersonel.flatMap(p => {
      const son = sonEgitimBul(p.id, isgTurRapor.id);
      const d = durumHesapla(son, isgTurRapor.periyotFn(firma?.tehlike_sinifi), "Eğitim Eksik");
      return d.onc >= 3 ? [{ p, tip: isgTurRapor.ad, icon: isgTurRapor.icon, d }] : [];
    }).sort((a, b) => b.d.onc - a.d.onc) : [];

    const muayeneEksik = firmaPersonel.flatMap(p =>
      MUAYENE_TURLERI.flatMap(m => {
        const son = sonMuayeneBul(p.id, m.id);
        const periyot = m.periyotFn(firma?.tehlike_sinifi);
        if (!periyot) return [];
        const d = durumHesapla(son, periyot, "Muayene Eksik");
        return d.onc >= 3 ? [{ p, tip: m.ad, icon: m.icon, d }] : [];
      })
    ).sort((a, b) => b.d.onc - a.d.onc);

    const dokumanEksik = dokumanlar.filter(d => d.firma_id === secFirmaId && (d.durum === "YOK" || d.durum === "PLANLANACAK"));

    const RAPOR_TABS = [
      { id: "egitim",  label: "Eğitim Eksikleri",  icon: "🎓", sayi: egitimEksik.length },
      { id: "muayene", label: "Muayene Eksikleri",  icon: "🩺", sayi: muayeneEksik.length },
      { id: "dokuman", label: "Döküman Eksikleri",  icon: "📄", sayi: dokumanEksik.length },
    ];

    const DOKUMAN_KATEGORILER = [
      { id: "risk", ad: "Risk Değerlendirmesi", icon: "⚠️" },
      { id: "acil", ad: "Acil Durum", icon: "🚨" },
      { id: "isgkurul", ad: "İSG Kurulu", icon: "👥" },
      { id: "plan", ad: "Yıllık Plan & Rapor", icon: "📅" },
      { id: "atama", ad: "Atama & Görevlendirme", icon: "📌" },
      { id: "diger", ad: "Diğer", icon: "📄" },
    ];

    return (
      <div>
        <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
          <select value={secFirmaId || ""} onChange={e => setSecFirmaId(Number(e.target.value))}
            style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 14, minWidth: 240 }}>
            {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
          {firma && <span style={{ background: "#ecf0f1", borderRadius: 8, padding: "6px 12px", fontSize: 13, color: "#ADB5BD" }}>{TEHLIKE[firma.tehlike_sinifi]?.icon} {firma.tehlike_sinifi} · {firmaPersonel.length} personel</span>}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {RAPOR_TABS.map(t => (
            <button key={t.id} onClick={() => setAktifRapor(t.id)} style={{
              padding: "10px 20px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
              background: aktifRapor === t.id ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "#111827",
              color: aktifRapor === t.id ? "#fff" : "#6b7280",
            }}>
              {t.icon} {t.label}
              <span style={{ marginLeft: 8, background: t.sayi > 0 ? "#ef4444" : "#374151", color: "#fff", borderRadius: 20, padding: "2px 8px", fontSize: 11 }}>{t.sayi}</span>
            </button>
          ))}
        </div>
        {aktifRapor === "egitim" && (
          <Card>
            <CardHeader title={`🎓 Eğitim Eksikleri — ${firma?.ad || ""} (${egitimEksik.length})`} />
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#F4F7F6" }}>
                {["Personel", "Eğitim Türü", "Durum", ""].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {egitimEksik.map((k, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #dde3e0" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#233142" }}>{k.p.ad_soyad}</td>
                    <td style={{ padding: "12px 16px", color: "#ADB5BD", fontSize: 13 }}>{k.icon} {k.tip}</td>
                    <td style={{ padding: "12px 16px" }}><Badge d={k.d} /></td>
                    <td style={{ padding: "12px 16px" }}><Btn onClick={() => { setSecPersonel(k.p); setAktifTab("egitim"); }} variant="danger" style={{ fontSize: 12, padding: "6px 12px" }}>Güncelle</Btn></td>
                  </tr>
                ))}
                {egitimEksik.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#27ae60" }}>✅ Tüm eğitimler güncel!</td></tr>}
              </tbody>
            </table>
          </Card>
        )}
        {aktifRapor === "muayene" && (
          <Card>
            <CardHeader title={`🩺 Muayene Eksikleri — ${firma?.ad || ""} (${muayeneEksik.length})`} />
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#F4F7F6" }}>
                {["Personel", "Muayene Türü", "Durum", ""].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {muayeneEksik.map((k, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #dde3e0" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#233142" }}>{k.p.ad_soyad}</td>
                    <td style={{ padding: "12px 16px", color: "#ADB5BD", fontSize: 13 }}>{k.icon} {k.tip}</td>
                    <td style={{ padding: "12px 16px" }}><Badge d={k.d} /></td>
                    <td style={{ padding: "12px 16px" }}><Btn onClick={() => { setSecPersonel(k.p); setAktifTab("muayene"); }} variant="danger" style={{ fontSize: 12, padding: "6px 12px" }}>Güncelle</Btn></td>
                  </tr>
                ))}
                {muayeneEksik.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#27ae60" }}>✅ Tüm muayeneler güncel!</td></tr>}
              </tbody>
            </table>
          </Card>
        )}
        {aktifRapor === "dokuman" && (
          <Card>
            <CardHeader title={`📄 Döküman Eksikleri — ${firma?.ad || ""} (${dokumanEksik.length})`} />
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#F4F7F6" }}>
                {["Başlık", "Kategori", "Durum", "Notlar"].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {dokumanEksik.map((k, i) => {
                  const kat = DOKUMAN_KATEGORILER.find(x => x.id === k.kategori);
                  return (
                    <tr key={k.id} style={{ borderTop: "1px solid #dde3e0" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#233142" }}>{k.baslik}</td>
                      <td style={{ padding: "12px 16px", color: "#ADB5BD", fontSize: 13 }}>{kat?.icon} {kat?.ad}</td>
                      <td style={{ padding: "12px 16px" }}><span style={{ color: k.durum === "YOK" ? "#f87171" : "#fbbf24", fontWeight: 700, fontSize: 13 }}>{k.durum}</span></td>
                      <td style={{ padding: "12px 16px", color: "#ADB5BD", fontSize: 12 }}>{k.notlar}</td>
                    </tr>
                  );
                })}
                {dokumanEksik.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#27ae60" }}>✅ Döküman eksiği yok!</td></tr>}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    );
  };

  const AyarlarSayfa = () => {
    const [form, setForm] = useState({ ad: "", icon: "📚", periyot: 24 });
    const [duzenleId, setDuzenleId] = useState(null);
    const [duzenleForm, setDuzenleForm] = useState({});
    const [kayit, setKayit] = useState(false);

    const ekle = async () => {
      if (!form.ad) return;
      setKayit(true);
      await supabase.from("egitim_turleri").insert({ ad: form.ad, icon: form.icon, periyot: Number(form.periyot) });
      await veriYukle();
      setForm({ ad: "", icon: "📚", periyot: 24 });
      setKayit(false);
    };

    const guncelle = async (id) => {
      await supabase.from("egitim_turleri").update({ ad: duzenleForm.ad, icon: duzenleForm.icon, periyot: Number(duzenleForm.periyot) }).eq("id", id);
      await veriYukle();
      setDuzenleId(null);
    };

    const sil = async (id) => {
      if (!window.confirm("Bu eğitim türünü silmek istediğinize emin misiniz?")) return;
      await supabase.from("egitim_turleri").update({ aktif: false }).eq("id", id);
      await veriYukle();
    };

    const IKONLAR = ["📚","🛡️","🔥","🏥","⛑","⚡","🔧","🚜","🏗","🧯","🦺","📋","🎯","🔑","💊"];

    return (
      <div>
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="⚙️ Eğitim Türleri Yönetimi" />
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: "#ADB5BD", marginBottom: 16 }}>Eğitim türlerini buradan ekleyebilir, düzenleyebilir veya pasife alabilirsiniz.</div>
            {/* Yeni ekleme formu */}
            <div style={{ background: "#F4F7F6", borderRadius: 10, padding: 16, marginBottom: 20, border: "1px solid #1e293b" }}>
              <div style={{ fontWeight: 700, color: "#454545", marginBottom: 12, fontSize: 14 }}>➕ Yeni Eğitim Türü Ekle</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#ADB5BD", marginBottom: 5 }}>Eğitim Adı</label>
                  <input value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} placeholder="Örn: İş Güvenliği Uzmanlığı"
                    style={{ width: "100%", padding: "9px 12px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#ADB5BD", marginBottom: 5 }}>İkon</label>
                  <select value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                    style={{ width: "100%", padding: "9px 12px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 18 }}>
                    {IKONLAR.map(ik => <option key={ik} value={ik}>{ik}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#ADB5BD", marginBottom: 5 }}>Periyot (ay)</label>
                  <input type="number" min="1" max="120" value={form.periyot} onChange={e => setForm(f => ({ ...f, periyot: e.target.value }))}
                    style={{ width: "100%", padding: "9px 12px", background: "#ffffff", border: "1px solid #dde3e0", borderRadius: 8, color: "#454545", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <Btn onClick={ekle} disabled={!form.ad || kayit} variant="success" style={{ padding: "9px 20px" }}>
                  {kayit ? "..." : "Ekle"}
                </Btn>
              </div>
            </div>

            {/* Mevcut liste */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F4F7F6" }}>
                  {["İkon", "Eğitim Adı", "Periyot", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: "#233142", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {egitimTurleri.map((et, i) => (
                  <tr key={et.id} style={{ borderTop: "1px solid #dde3e0" }}>
                    {duzenleId === et.id ? (
                      <>
                        <td style={{ padding: "10px 16px" }}>
                          <select value={duzenleForm.icon} onChange={e => setDuzenleForm(f => ({ ...f, icon: e.target.value }))}
                            style={{ padding: "6px 8px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: "#454545", fontSize: 18 }}>
                            {IKONLAR.map(ik => <option key={ik} value={ik}>{ik}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <input value={duzenleForm.ad} onChange={e => setDuzenleForm(f => ({ ...f, ad: e.target.value }))}
                            style={{ width: "100%", padding: "7px 10px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: "#454545", fontSize: 13 }} />
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <input type="number" value={duzenleForm.periyot} onChange={e => setDuzenleForm(f => ({ ...f, periyot: e.target.value }))}
                            style={{ width: 80, padding: "7px 10px", background: "#F4F7F6", border: "1px solid #dde3e0", borderRadius: 6, color: "#454545", fontSize: 13 }} />
                          <span style={{ color: "#ADB5BD", fontSize: 12, marginLeft: 6 }}>ay</span>
                        </td>
                        <td style={{ padding: "10px 16px", display: "flex", gap: 6 }}>
                          <Btn variant="success" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => guncelle(et.id)}>✓ Kaydet</Btn>
                          <Btn variant="secondary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setDuzenleId(null)}>İptal</Btn>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "12px 16px", fontSize: 22 }}>{et.icon}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "#233142" }}>{et.ad}</td>
                        <td style={{ padding: "12px 16px", color: "#ADB5BD", fontSize: 13 }}>Her <strong style={{ color: "#233142" }}>{et.periyot}</strong> ayda bir</td>
                        <td style={{ padding: "12px 16px", display: "flex", gap: 6 }}>
                          <Btn variant="secondary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => { setDuzenleId(et.id); setDuzenleForm({ ad: et.ad, icon: et.icon, periyot: et.periyot }); }}>✏️ Düzenle</Btn>
                          <Btn variant="danger" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => sil(et.id)}>Pasife Al</Btn>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {egitimTurleri.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#ADB5BD" }}>Henüz eğitim türü yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const NAV_ITEMS = [
    { id: "dashboard",     label: "Ana Sayfa",       icon: "🏠" },
    { id: "personel",      label: "Personel",        icon: "👷" },
    { id: "egitimtakip",   label: "Eğitim Takip",    icon: "🎓" },
    { id: "muayenetakip",  label: "Muayene Takip",   icon: "🩺" },
    { id: "dokumanlar",    label: "Dökümanlar",      icon: "📁" },
    { id: "rapor",         label: "Raporlar",        icon: "📋" },
    { id: "ayarlar",       label: "Ayarlar",         icon: "⚙️" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7F6", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#454545", display: "flex" }}>
      {/* ── SIDEBAR ── */}
      <div style={{ width: 240, minHeight: "100vh", background: "#233142", borderRight: "none", display: "flex", flexDirection: "column", flexShrink: 0, boxShadow: "4px 0 12px #00000022" }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #ffffff15" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🛡️</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#ffffff", lineHeight: 1.2 }}>İSG Takip</div>
              <div style={{ fontSize: 10, color: "#ADB5BD" }}>Sistemi</div>
            </div>
          </div>
        </div>
        {/* Menü */}
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setSayfa(id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
              borderRadius: 9, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
              marginBottom: 4, textAlign: "left",
              background: sayfa === id ? "#34495E" : "transparent",
              color: sayfa === id ? "#ffffff" : "#bfdbfe",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        {/* Alt kullanıcı bilgisi */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid #ffffff15" }}>
          <div style={{ fontSize: 11, color: "#ADB5BD", marginBottom: 8, wordBreak: "break-all" }}>{oturum?.user?.email}</div>
          <button onClick={cikisYap} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Çıkış Yap</button>
        </div>
      </div>
      {/* ── İÇERİK ── */}
      <div style={{ flex: 1, padding: 28, overflowY: "auto", background: "#F4F7F6" }}>
        {sayfa === "dashboard"    && <Dashboard />}
        {sayfa === "personel"     && <PersonelSayfa />}
        {sayfa === "egitimtakip"  && <EgitimTakipSayfa />}
        {sayfa === "muayenetakip" && <MuayeneTakipSayfa />}
        {sayfa === "dokumanlar"   && <DokumanlarSayfa />}
        {sayfa === "rapor"        && <RaporSayfa />}
        {sayfa === "ayarlar"      && <AyarlarSayfa />}
      </div>
      {modal === "firma-ekle"        && <FirmaEkleModal />}
      {(modal === "personel-guncelle" || modal === "import") && <ImportModal />}
      {secPersonel && <PersonelDetay p={secPersonel} />}
      {secFirmaDetay && <FirmaGuncelleModal firma={secFirmaDetay} />}
    </div>
  );
}
